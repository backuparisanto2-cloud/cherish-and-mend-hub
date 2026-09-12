// Server-only: memetakan event webhook Chatera ke tabel contacts / conversations / messages.

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type ChateraEventBody = {
  id?: string;
  event?: string;
  timestamp?: string;
  organization_id?: string;
  data?: Record<string, unknown>;
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function normalizePhone(input: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return null;
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function isoOrNow(value: unknown): string {
  const raw = str(value);
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

/** Cari atau buat kontak dari data event. */
async function upsertContact(
  db: SupabaseAdmin,
  input: {
    contactId: string | null;
    phone: string | null;
    name: string | null;
    email: string | null;
    channelId: string | null;
  },
): Promise<string | null> {
  const phone = normalizePhone(input.phone);
  if (!input.contactId && !phone) return null;

  let existingId: string | null = null;
  if (input.contactId) {
    const { data } = await db
      .from("contacts")
      .select("id")
      .eq("chatera_contact_id", input.contactId)
      .maybeSingle();
    existingId = data?.id ?? null;
  }
  if (!existingId && phone) {
    const { data } = await db.from("contacts").select("id").eq("wa_number", phone).maybeSingle();
    existingId = data?.id ?? null;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.contactId) patch["chatera_contact_id"] = input.contactId;
  if (phone) patch["wa_number"] = phone;
  if (input.name) patch["name"] = input.name;
  if (input.email) patch["email"] = input.email;
  if (input.channelId) patch["channel_id"] = input.channelId;

  if (existingId) {
    await db.from("contacts").update(patch as never).eq("id", existingId);
    return existingId;
  }

  const { data, error } = await db.from("contacts").insert(patch as never).select("id").maybeSingle();
  if (error || !data) {
    // Kemungkinan race duplikat: coba baca kembali.
    if (input.contactId) {
      const { data: again } = await db
        .from("contacts")
        .select("id")
        .eq("chatera_contact_id", input.contactId)
        .maybeSingle();
      if (again) return again.id;
    }
    if (phone) {
      const { data: again } = await db
        .from("contacts")
        .select("id")
        .eq("wa_number", phone)
        .maybeSingle();
      if (again) return again.id;
    }
    return null;
  }
  return data.id;
}

/** Cari atau buat percakapan berdasarkan conversationId Chatera. */
async function upsertConversation(
  db: SupabaseAdmin,
  input: {
    conversationId: string | null;
    contactDbId: string | null;
    lastMessageAt?: string;
    status?: "bot_active" | "waiting_agent" | "agent_active" | "closed";
    assigneeId?: string | null;
  },
): Promise<string | null> {
  if (!input.conversationId) return null;

  const { data: existing } = await db
    .from("conversations")
    .select("id")
    .eq("chatera_conversation_id", input.conversationId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};
  if (input.contactDbId) patch["contact_id"] = input.contactDbId;
  if (input.lastMessageAt) patch["last_message_at"] = input.lastMessageAt;
  if (input.status) patch["status"] = input.status;
  if (input.assigneeId !== undefined) patch["assigned_agent_chatera_id"] = input.assigneeId;

  if (existing) {
    if (Object.keys(patch).length > 0) {
      await db.from("conversations").update(patch as never).eq("id", existing.id);
    }
    return existing.id;
  }

  // Percakapan baru SELALU dimulai dari bot (status bot_active, menu di akar),
  // termasuk bila Chatera langsung mengirim event assigned untuk nomor baru.
  const { data, error } = await db
    .from("conversations")
    .insert({
      chatera_conversation_id: input.conversationId,
      ...patch,
      status: "bot_active",
      current_menu_path: null,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    const { data: again } = await db
      .from("conversations")
      .select("id")
      .eq("chatera_conversation_id", input.conversationId)
      .maybeSingle();
    return again?.id ?? null;
  }
  return data.id;
}

async function handleMessageEvent(
  db: SupabaseAdmin,
  event: string,
  data: Record<string, unknown>,
): Promise<{ conversationId: string | null; senderPhone: string | null; text: string | null }> {
  const sender = (data["sender"] ?? {}) as Record<string, unknown>;
  const inbound = event === "message.inbound";
  const direction = inbound ? "inbound" : (str(data["direction"]) ?? "outbound");
  const senderPhone = normalizePhone(str(sender["phone"]) ?? str(data["phone"]));

  const contactDbId = await upsertContact(db, {
    contactId: str(data["contactId"]),
    phone: senderPhone,
    name: str(sender["name"]),
    email: null,
    channelId: str(data["channelId"]),
  });

  const createdAt = isoOrNow(data["timestamp"]);
  const conversationDbId = await upsertConversation(db, {
    conversationId: str(data["conversationId"]),
    contactDbId,
    lastMessageAt: createdAt,
  });

  const content = (data["content"] ?? {}) as Record<string, unknown>;
  const chateraMessageId = str(data["messageId"]);

  const row = {
    conversation_id: conversationDbId,
    chatera_message_id: chateraMessageId,
    whatsapp_message_id: str(data["whatsappMessageId"]),
    direction,
    sender_type: (inbound ? "user" : "bot") as "user" | "bot" | "agent",
    content_type: str(data["contentType"]) ?? "text",
    content: content as never,
    status: str(data["status"]),
    created_at: createdAt,
  };

  if (chateraMessageId) {
    const { data: existing } = await db
      .from("messages")
      .select("id")
      .eq("chatera_message_id", chateraMessageId)
      .maybeSingle();
    if (existing) {
      await db.from("messages").update(row).eq("id", existing.id);
    } else {
      await db.from("messages").insert(row);
    }
  } else {
    await db.from("messages").insert(row);
  }

  const text =
    str((content["text"] as Record<string, unknown> | undefined)?.["body"]) ??
    str(content["text"]) ??
    str(
      ((content["interactive"] as Record<string, unknown> | undefined)?.["reply"] as
        | Record<string, unknown>
        | undefined)?.["id"],
    ) ??
    str(
      ((content["interactive"] as Record<string, unknown> | undefined)?.["list_reply"] as
        | Record<string, unknown>
        | undefined)?.["id"],
    ) ??
    null;

  return { conversationId: str(data["conversationId"]), senderPhone, text };
}

async function updateMessageStatus(
  db: SupabaseAdmin,
  data: Record<string, unknown>,
  fallbackStatus: string,
): Promise<void> {
  const messageId = str(data["messageId"]);
  if (!messageId) return;
  await db
    .from("messages")
    .update({ status: str(data["status"]) ?? fallbackStatus })
    .eq("chatera_message_id", messageId);
}

export type ProcessResult = {
  handled: boolean;
  inbound?: {
    conversationId: string | null;
    senderPhone: string | null;
    text: string | null;
    channelId: string | null;
  };
};

/** Proses satu event webhook Chatera. */
export async function processChateraEvent(
  db: SupabaseAdmin,
  event: string,
  body: ChateraEventBody,
): Promise<ProcessResult> {
  const data = (body.data ?? {}) as Record<string, unknown>;

  switch (event) {
    case "message.inbound":
    case "message.sent": {
      const result = await handleMessageEvent(db, event, data);
      if (event !== "message.inbound") return { handled: true };
      return {
        handled: true,
        inbound: {
          conversationId: result.conversationId,
          senderPhone: result.senderPhone,
          text: result.text,
          channelId: str(data["channelId"]),
        },
      };
    }
    case "message.delivered":
      await updateMessageStatus(db, data, "delivered");
      return { handled: true };
    case "message.read":
      await updateMessageStatus(db, data, "read");
      return { handled: true };
    case "message.failed":
      await updateMessageStatus(db, data, "failed");
      return { handled: true };
    case "contact.created":
    case "contact.updated": {
      await upsertContact(db, {
        contactId: str(data["contactId"]),
        phone: str(data["phone"]),
        name: str(data["name"]),
        email: str(data["email"]),
        channelId: str(data["channelId"]),
      });
      return { handled: true };
    }
    case "conversation.opened": {
      const contactDbId = await upsertContact(db, {
        contactId: str(data["contactId"]),
        phone: str(data["phone"]),
        name: str(data["name"]),
        email: null,
        channelId: str(data["channelId"]),
      });
      await upsertConversation(db, {
        conversationId: str(data["conversationId"]),
        contactDbId,
        status: "bot_active",
        lastMessageAt: isoOrNow(data["timestamp"]),
      });
      return { handled: true };
    }
    case "conversation.assigned": {
      const contactDbId = await upsertContact(db, {
        contactId: str(data["contactId"]),
        phone: str(data["phone"]),
        name: null,
        email: null,
        channelId: str(data["channelId"]),
      });
      // Event assigned dari Chatera adalah auto-routing/default assignment di
      // sisi Chatera, BUKAN aksi "Ambil Alih dari Bot" aplikasi kita. Status
      // conversation hanya boleh berubah lewat dashboard (manual) atau logika bot
      // (eskalasi ke waiting_agent). Jadi di sini hanya simpan assigneeId sebagai
      // metadata referensi tanpa mengubah status.
      await upsertConversation(db, {
        conversationId: str(data["conversationId"]),
        contactDbId,
        assigneeId: str(data["assigneeId"]),
      });
      return { handled: true };
    }
    case "conversation.resolved": {
      const contactDbId = await upsertContact(db, {
        contactId: str(data["contactId"]),
        phone: str(data["phone"]),
        name: null,
        email: null,
        channelId: str(data["channelId"]),
      });
      await upsertConversation(db, {
        conversationId: str(data["conversationId"]),
        contactDbId,
        status: "closed",
      });
      return { handled: true };
    }
    default:
      return { handled: false };
  }
}

/** Catat pesan keluar (bot atau agent) agar tampil pada percakapan yang sama. */
export async function recordOutboundMessage(
  db: SupabaseAdmin,
  input: {
    conversationId: string | null;
    phone: string;
    text: string;
    messageId: string | null;
    senderType: "bot" | "agent";
    channelId?: string | null;
    agentUserId?: string | null;
    agentName?: string | null;
    matchedCategory?: string | null;
  },
): Promise<void> {
  const phone = normalizePhone(input.phone);
  const contactDbId = await upsertContact(db, {
    contactId: null,
    phone,
    name: null,
    email: null,
    channelId: input.channelId ?? null,
  });
  const now = new Date().toISOString();
  const conversationDbId = await upsertConversation(db, {
    conversationId: input.conversationId,
    contactDbId,
    lastMessageAt: now,
  });
  await db.from("messages").insert({
    conversation_id: conversationDbId,
    chatera_message_id: input.messageId,
    direction: "outbound",
    sender_type: input.senderType,
    content_type: "text",
    content: { text: { body: input.text } } as never,
    agent_user_id: input.agentUserId ?? null,
    agent_name: input.agentName ?? null,
    matched_knowledge_category: input.matchedCategory ?? null,
    created_at: now,
  });
}

