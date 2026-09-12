// Server-only: mencatat setiap perubahan status percakapan agar admin bisa
// melacak eskalasi (bot_active -> waiting_agent) dan penugasan dari Chatera.

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type StatusEventSource = "bot" | "dashboard" | "chatera" | "system";

export type StatusEventInput = {
  conversationDbId?: string | null;
  chateraConversationId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  source: StatusEventSource;
  actor?: string | null;
  assigneeChateraId?: string | null;
};

/** Simpan satu baris riwayat status. Kegagalan tidak boleh mengganggu alur utama. */
export async function logStatusEvent(
  db: SupabaseAdmin,
  input: StatusEventInput,
): Promise<void> {
  try {
    let conversationId = input.conversationDbId ?? null;
    if (!conversationId && input.chateraConversationId) {
      const { data } = await db
        .from("conversations")
        .select("id")
        .eq("chatera_conversation_id", input.chateraConversationId)
        .maybeSingle();
      conversationId = data?.id ?? null;
    }

    await db.from("conversation_status_events").insert({
      conversation_id: conversationId,
      chatera_conversation_id: input.chateraConversationId ?? null,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      source: input.source,
      actor: input.actor ?? null,
      assignee_chatera_id: input.assigneeChateraId ?? null,
    });
  } catch (err) {
    console.error("Gagal mencatat riwayat status percakapan", err);
  }
}
