import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TakeoverAction = "take_over" | "return_to_bot" | "close";

/** Ubah status percakapan: ambil alih oleh agent atau kembalikan ke bot. */
export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string; action: TakeoverAction }) => {
    const conversationId = String(input?.conversationId ?? "");
    if (!conversationId) throw new Error("Percakapan tidak valid");
    const allowed: TakeoverAction[] = ["take_over", "return_to_bot", "close"];
    if (!allowed.includes(input?.action)) {
      throw new Error("Aksi tidak dikenal");
    }
    return { conversationId, action: input.action };
  })
  .handler(async ({ data, context }) => {
    let agentName = "Operator";
    if (data.action === "take_over") {
      const profile = await context.supabase
        .from("users")
        .select("full_name, email")
        .eq("id", context.userId)
        .maybeSingle();
      agentName = profile.data?.full_name || profile.data?.email || "Operator";
    }

    const update =
      data.action === "take_over"
        ? {
            status: "agent_active" as const,
            agent_user_id: context.userId,
            agent_name: agentName,
          }
        : data.action === "close"
          ? { status: "closed" as const, current_menu_path: null }
          : {
              status: "bot_active" as const,
              agent_user_id: null,
              agent_name: null,
              current_menu_path: null,
            };

    const { data: updated, error } = await context.supabase
      .from("conversations")
      .update(update)
      .eq("id", data.conversationId)
      .select("chatera_conversation_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (data.action === "close" && updated?.chatera_conversation_id) {
      const { sendClosingSurvey } = await import("@/lib/chatera-bot.server");
      try {
        await sendClosingSurvey(updated.chatera_conversation_id);
      } catch (err) {
        console.error("Gagal mengirim survei penutup", err);
      }
    }
    return { ok: true, status: update.status };
  });
