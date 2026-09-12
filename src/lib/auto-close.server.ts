// Server-only: menutup percakapan yang menganggur lebih dari 30 menit,
// lalu mengirim pesan penutup + survei kepuasan (sekali saja).

const IDLE_MINUTES = 30;

export type AutoCloseResult = {
  ok: true;
  closed: number;
  surveysSent: number;
};

export async function closeIdleConversations(): Promise<AutoCloseResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendClosingSurvey } = await import("@/lib/chatera-bot.server");

  const cutoff = new Date(Date.now() - IDLE_MINUTES * 60_000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("conversations")
    .update({ status: "closed", current_menu_path: null })
    .in("status", ["bot_active", "waiting_agent", "agent_active"])
    .lt("last_message_at", cutoff)
    .select("chatera_conversation_id");
  if (error) throw new Error(error.message);

  let surveysSent = 0;
  for (const row of rows ?? []) {
    const conversationId = row.chatera_conversation_id;
    if (!conversationId) continue;
    try {
      // sendClosingSurvey mengklaim survey_sent_at secara atomik,
      // jadi survei tidak akan terkirim dua kali walau job berjalan lagi.
      await sendClosingSurvey(conversationId);
      surveysSent += 1;
    } catch (err) {
      console.error("Gagal mengirim survei penutup otomatis", conversationId, err);
    }
  }

  return { ok: true, closed: rows?.length ?? 0, surveysSent };
}
