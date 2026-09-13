// Memori percakapan chatbot: mengambil beberapa giliran terakhir dari tabel
// messages supaya jawaban AI ingat konteks sebelumnya (nama, dokumen yang
// sedang dibahas, pertanyaan lanjutan seperti "kalau saya belum punya?").
// Server-only.

export type MemoryTurn = { role: "user" | "assistant"; content: string };

/** Jumlah giliran (pesan) terakhir yang diingat bot. */
export const MEMORY_TURNS = 10;
const MAX_CHARS = 700;

function extractText(content: unknown, contentType: string | null): string | null {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return null;
  const c = content as Record<string, any>;
  const candidate =
    c["body"] ??
    c["text"]?.["body"] ??
    (typeof c["text"] === "string" ? c["text"] : null) ??
    c["caption"] ??
    c["message"] ??
    null;
  if (typeof candidate === "string" && candidate.trim()) return candidate;
  if (contentType && contentType !== "text") return `[${contentType}]`;
  return null;
}

/**
 * Ambil riwayat singkat percakapan (paling lama -> paling baru), tanpa pesan
 * terakhir warga yang sedang diproses. Gagal apa pun -> memori kosong.
 */
export async function loadConversationMemory(
  chateraConversationId: string | null | undefined,
  options: { excludeText?: string | null; limit?: number } = {},
): Promise<MemoryTurn[]> {
  if (!chateraConversationId) return [];
  const limit = options.limit ?? MEMORY_TURNS;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("chatera_conversation_id", chateraConversationId)
      .maybeSingle();
    const conversationId = (conversation as { id?: string } | null)?.id;
    if (!conversationId) return [];

    const { data: rows } = await supabaseAdmin
      .from("messages")
      .select("direction, sender_type, content, content_type, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit + 4);
    if (!rows || rows.length === 0) return [];

    const turns: MemoryTurn[] = [];
    for (const row of rows as Array<Record<string, any>>) {
      const text = extractText(row["content"], row["content_type"] ?? null);
      if (!text) continue;
      const trimmed = text.trim().slice(0, MAX_CHARS);
      if (!trimmed) continue;
      const role: MemoryTurn["role"] =
        row["sender_type"] === "user" || row["direction"] === "inbound" ? "user" : "assistant";
      turns.push({ role, content: trimmed });
    }

    // Buang pesan warga yang sedang diproses (biasanya baris terbaru).
    const exclude = options.excludeText?.trim();
    if (exclude) {
      const idx = turns.findIndex((t) => t.role === "user" && t.content.trim() === exclude);
      if (idx >= 0) turns.splice(idx, 1);
    }

    return turns.reverse().slice(-limit);
  } catch (err) {
    console.error("Gagal memuat memori percakapan", err);
    return [];
  }
}
