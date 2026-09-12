// Server-only handler for Chatera webhook deliveries.
// Verifies HMAC-SHA256 signatures, then stores inbound WhatsApp messages.

const MAX_SKEW_SECONDS = 300;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type ChateraPayload = {
  data?: {
    messageId?: string;
    conversationId?: string;
    channelId?: string;
    timestamp?: string;
    sender?: { phone?: string; name?: string };
    content?: { text?: string };
  };
};

export async function handleChateraWebhook(request: Request): Promise<Response> {
  const secret = process.env["CHATERA_WEBHOOK_SECRET"];
  if (!secret) return json({ error: "Webhook secret not configured" }, 500);

  const timestamp = request.headers.get("x-chatera-timestamp");
  const signature = (request.headers.get("x-chatera-signature") ?? "").replace(/^sha256=/i, "");
  const event = request.headers.get("x-chatera-event");
  const deliveryId = request.headers.get("x-chatera-delivery-id");

  if (!timestamp || !signature || !event || !deliveryId) {
    return json({ error: "Missing Chatera webhook headers" }, 400);
  }

  const ts = Number(timestamp);
  const tsSeconds = Number.isFinite(ts) ? (ts > 1e12 ? Math.floor(ts / 1000) : ts) : NaN;
  if (!Number.isFinite(tsSeconds)) return json({ error: "Invalid timestamp" }, 400);
  if (Math.abs(Math.floor(Date.now() / 1000) - tsSeconds) > MAX_SKEW_SECONDS) {
    return json({ error: "Timestamp outside tolerance window" }, 401);
  }

  const rawBody = await request.text();

  // Accept the documented `${timestamp}.${body}` signing base; fall back to the
  // raw body form used by older Chatera deliveries.
  const candidates = await Promise.all([
    hmacHex(secret, `${timestamp}.${rawBody}`),
    hmacHex(secret, rawBody),
  ]);
  const provided = signature.toLowerCase();
  if (!candidates.some((expected) => timingSafeEqual(expected, provided))) {
    return json({ error: "Invalid signature" }, 401);
  }


  let payload: ChateraPayload;
  try {
    payload = JSON.parse(rawBody) as ChateraPayload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const data = payload.data ?? {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) DEDUPLIKASI PALING AWAL: klaim delivery_id dengan INSERT atomik.
  //    Tidak boleh ada efek samping (simpan pesan, panggil bot, kirim ke
  //    Chatera API) sebelum langkah ini lolos. Jika delivery_id sudah pernah
  //    diproses, insert gagal karena constraint UNIQUE -> langsung berhenti.
  const { error: claimError } = await supabaseAdmin
    .from("webhook_deliveries")
    .insert({ delivery_id: deliveryId, event });
  if (claimError) {
    if (claimError.code === "23505") {
      // Duplikat: delivery ini sudah pernah diproses. Jangan lanjut apa pun.
      return json({ ok: true, duplicate: true }, 200);
    }
    console.error("Gagal mencatat delivery", claimError);
    return json({ error: "Failed to record delivery" }, 500);
  }

  // 2) Proses event sesuai jenisnya (hanya untuk delivery_id baru).
  const { processChateraEvent } = await import("@/lib/chatera-events.server");
  let inbound: Awaited<ReturnType<typeof processChateraEvent>>["inbound"];
  try {
    const result = await processChateraEvent(
      supabaseAdmin,
      event,
      payload as { data?: Record<string, unknown> },
    );
    inbound = result.inbound;
  } catch (err) {
    console.error("Gagal memproses event Chatera", event, err);
    return json({ error: "Failed to process event" }, 500);
  }

  // 2b) Percakapan ditutup -> kirim pesan penutup + survei (sekali saja).
  if (event === "conversation.resolved") {
    const { sendClosingSurvey } = await import("@/lib/chatera-bot.server");
    try {
      await sendClosingSurvey(data.conversationId ?? null);
    } catch (err) {
      console.error("Gagal mengirim survei penutup", err);
    }
  }

  // Kompatibilitas: arsip pesan inbound pada tabel lama.
  if (event === "message.inbound") {
    const eventTimestamp = data.timestamp ? new Date(data.timestamp) : null;
    const { error: legacyError } = await supabaseAdmin.from("chatera_messages").insert({
      delivery_id: deliveryId,
      event_type: event,
      message_id: data.messageId ?? null,
      conversation_id: data.conversationId ?? null,
      channel_id: data.channelId ?? null,
      sender_phone: data.sender?.phone ?? null,
      sender_name: data.sender?.name ?? null,
      content_text: inbound?.text ?? null,
      event_timestamp:
        eventTimestamp && !Number.isNaN(eventTimestamp.getTime())
          ? eventTimestamp.toISOString()
          : null,
    });
    if (legacyError && legacyError.code !== "23505") {
      console.error("Gagal mengarsipkan pesan pada tabel lama", legacyError);
    }
  }

  // 3) Auto-reply chatbot Purworejo untuk pesan masuk (hanya delivery baru).
  //    Bot diam bila percakapan sedang ditangani agent (agent_active) atau
  //    sudah menunggu agent (waiting_agent).
  let autoReplied = false;
  let escalated = false;
  let conversationStatus: string | null = null;
  let currentMenuPath: string | null = null;
  let awaitingOperatorConfirmation = false;
  let language: "id" | "en" = "id";
  if (inbound?.senderPhone && inbound.conversationId) {
    const { data: conversationRow } = await supabaseAdmin
      .from("conversations")
      .select("status, current_menu_path, awaiting_operator_confirmation, language")
      .eq("chatera_conversation_id", inbound.conversationId)
      .maybeSingle();
    conversationStatus = conversationRow?.status ?? null;
    currentMenuPath = conversationRow?.current_menu_path ?? null;
    awaitingOperatorConfirmation =
      conversationRow?.awaiting_operator_confirmation ?? false;
    language =
      (conversationRow as { language?: string | null } | null)?.language === "en" ? "en" : "id";

    // Warga membalas setelah percakapan ditutup -> buka lagi untuk bot.
    if (conversationStatus === "closed") {
      await supabaseAdmin
        .from("conversations")
        .update({
          status: "bot_active",
          survey_sent_at: null,
          current_menu_path: null,
          awaiting_operator_confirmation: false,
        })
        .eq("chatera_conversation_id", inbound.conversationId);
      conversationStatus = "bot_active";
      currentMenuPath = null;
      awaitingOperatorConfirmation = false;
    }
  }
  const botShouldReply =
    Boolean(inbound?.senderPhone) &&
    conversationStatus !== "agent_active" &&
    conversationStatus !== "waiting_agent";
  let languageNotice: string | null = null;
  if (inbound?.senderPhone && botShouldReply) {
    const { resolveReply, sendBotReply, sendBotMessages, localizedMainMenu } =
      await import("@/lib/chatera-bot.server");
    const { botStrings, detectLanguageCommand, isAffirmativeIn, languageSwitchNotice } =
      await import("@/lib/bot-language");

    // Perintah bahasa: simpan pilihan warga, lalu jawab dalam bahasa tersebut.
    const requested = detectLanguageCommand(inbound.text);
    if (requested && requested !== language && inbound.conversationId) {
      language = requested;
      languageNotice = languageSwitchNotice(requested);
      await supabaseAdmin
        .from("conversations")
        .update({ language: requested })
        .eq("chatera_conversation_id", inbound.conversationId);
    } else if (requested) {
      languageNotice = languageSwitchNotice(requested);
    }

    // Balasan "ya" tepat setelah pesan tidak ditemukan = setuju disambungkan
    // ke petugas. Balasan lain membatalkan penanda dan diproses seperti biasa.
    const confirmedOperator =
      awaitingOperatorConfirmation && isAffirmativeIn(inbound.text);
    const AGENT_REPLY = botStrings(language).agentReply;
    const WAIT_NOTICE = botStrings(language).waitNotice;

    // Nama WhatsApp warga untuk sapaan personal (payload -> fallback kontak).
    let senderName: string | null = data.sender?.name ?? null;
    if (!senderName && inbound.senderPhone) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("name")
        .eq("wa_number", inbound.senderPhone)
        .maybeSingle();
      senderName = (contact as { name?: string | null } | null)?.name ?? null;
    }

    let result: {
      messages: string[];
      escalate: boolean;
      matchedCategory?: string | null;
      menuPath?: string | null | undefined;
      notFound?: boolean;
    };
    if (confirmedOperator) {
      result = { messages: [AGENT_REPLY], escalate: true, matchedCategory: null, menuPath: undefined, notFound: false };
    } else if (languageNotice) {
      // Perintah bahasa dijawab konfirmasi + menu utama dalam bahasa baru.
      const menu = await localizedMainMenu(language);
      result = {
        messages: [languageNotice, menu],
        escalate: false,
        matchedCategory: null,
        menuPath: null,
        notFound: false,
      };
    } else {
      const pending = resolveReply(inbound.text, currentMenuPath, senderName, language);
      // Kalau jawaban belum siap dalam 3 detik, warga lebih dulu diberi kabar
      // supaya tidak merasa dibiarkan menunggu.
      const race = await Promise.race([
        pending.then(() => "ready" as const),
        new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), 3_000)),
      ]);
      if (race === "slow") {
        await sendBotReply({
          to: inbound.senderPhone,
          text: WAIT_NOTICE,
          conversationId: inbound.conversationId,
          channelId: inbound.channelId,
        });
      }
      result = await pending;
    }
    const { escalate, matchedCategory, menuPath, notFound } = result;

    await sendBotMessages(
      {
        to: inbound.senderPhone,
        conversationId: inbound.conversationId,
        channelId: inbound.channelId,
        matchedCategory: matchedCategory ?? null,
      },
      result.messages,
    );
    autoReplied = true;

    if (inbound.conversationId) {
      const update: {
        awaiting_operator_confirmation: boolean;
        current_menu_path?: string | null;
      } = { awaiting_operator_confirmation: notFound === true };
      if (menuPath !== undefined) update.current_menu_path = menuPath ?? null;
      await supabaseAdmin
        .from("conversations")
        .update(update)
        .eq("chatera_conversation_id", inbound.conversationId);
    }

    if (escalate && inbound.conversationId) {
      escalated = true;
      const { error: statusError } = await supabaseAdmin
        .from("conversations")
        .update({ status: "waiting_agent" })
        .eq("chatera_conversation_id", inbound.conversationId);
      if (statusError) console.error("Gagal set status waiting_agent", statusError);
    }
  }

  return json({ ok: true, stored: true, autoReplied }, 200);
}

