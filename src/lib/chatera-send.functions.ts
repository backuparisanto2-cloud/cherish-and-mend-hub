import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CHATERA_BASE_URL = "https://api.chatera.id/v1";

export type SendResult = {
  ok: boolean;
  status: number;
  messageId?: string | null;
  error?: string;
  raw?: string;
};

function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export const sendWhatsappText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { to: string; text: string; conversationId?: string | null; channelId?: string | null }) => {
      const to = normalizePhone(String(input?.to ?? ""));
      const text = String(input?.text ?? "").trim();
      if (to.length < 8) throw new Error("Nomor WhatsApp tujuan tidak valid");
      if (!text) throw new Error("Isi pesan tidak boleh kosong");
      if (text.length > 4096) throw new Error("Isi pesan terlalu panjang");
      return {
        to,
        text,
        conversationId: input?.conversationId ?? null,
        channelId: input?.channelId ?? null,
      };
    },
  )
  .handler(async ({ data, context }): Promise<SendResult> => {
    const apiKey = process.env["CHATERA_API_KEY"];
    if (!apiKey) {
      return { ok: false, status: 500, error: "CHATERA_API_KEY belum diatur di server." };
    }

    let response: Response;
    try {
      response = await fetch(`${CHATERA_BASE_URL}/whatsapp/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          type: "text",
          to: data.to,
          text: { body: data.text },
        }),
      });
    } catch (err) {
      return {
        ok: false,
        status: 502,
        error: `Gagal menghubungi Chatera API: ${(err as Error).message}`,
      };
    }

    const raw = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const message =
        (parsed?.["message"] as string | undefined) ??
        (parsed?.["error"] as string | undefined) ??
        raw.slice(0, 500) ??
        "Permintaan ditolak";
      return { ok: false, status: response.status, error: message, raw: raw.slice(0, 1000) };
    }

    const dataField = (parsed?.["data"] as Record<string, unknown> | undefined) ?? undefined;
    const messageId =
      (dataField?.["messageId"] as string | undefined) ??
      (dataField?.["id"] as string | undefined) ??
      (parsed?.["messageId"] as string | undefined) ??
      (parsed?.["id"] as string | undefined) ??
      null;

    // Simpan balasan agar tampil dalam satu percakapan dengan pesan masuk.
    let agentName = "Operator";
    try {
      const profile = await context.supabase
        .from("users")
        .select("full_name, email")
        .eq("id", context.userId)
        .maybeSingle();
      agentName = profile.data?.full_name || profile.data?.email || "Operator";
    } catch {
      // biarkan nama default bila profil belum tersedia
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { recordOutboundMessage } = await import("@/lib/chatera-events.server");
      await recordOutboundMessage(supabaseAdmin, {
        conversationId: data.conversationId,
        phone: data.to,
        text: data.text,
        messageId,
        senderType: "agent",
        channelId: data.channelId,
        agentUserId: context.userId,
        agentName,
      });
      await supabaseAdmin.from("chatera_messages").insert({
        delivery_id: `outbound:${messageId ?? crypto.randomUUID()}`,
        event_type: "message.outbound",
        direction: "outbound",
        message_id: messageId,
        conversation_id: data.conversationId,
        channel_id: data.channelId,
        sender_phone: data.to,
        sender_name: agentName,
        content_text: data.text,
        event_timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Gagal menyimpan pesan keluar", err);
    }


    return { ok: true, status: response.status, messageId, raw: raw.slice(0, 1000) };
  });
