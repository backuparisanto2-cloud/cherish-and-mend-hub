// Terjemahan teks bot ke bahasa Inggris memakai AI eksternal (ai.jtg.pro),
// dengan cache di tabel bot_menu_translations supaya tidak menerjemahkan ulang.
// Server-only.

import type { BotLanguage } from "./bot-language";

const JTG_BASE_URL = "https://ai.jtg.pro/api";
const TIMEOUT_MS = 8_000;

const GLOSSARY_PROMPT =
  "You translate Indonesian public-service chatbot messages for the Purworejo Regency Government " +
  "(Indonesia) into natural, warm, plain English.\n" +
  "Rules:\n" +
  "1. KEEP the Indonesian name of every government document, institution, programme, and service " +
  "exactly as written (for example KTP, Kartu Keluarga, KIA, Akta Kelahiran, Akta Kematian, NIK, " +
  "PBB, BPHTB, Dukcapil, Puskesmas, RSUD, DPMPTSP, PORJO, Lekjo, Kelurahan, Kecamatan, Desa, RT, RW). " +
  "Add the English meaning in brackets on the FIRST mention only, e.g. " +
  "\"Kartu Keluarga (Family Card)\", \"KTP (Indonesian ID card)\", \"Kecamatan (sub-district office)\".\n" +
  "2. Do NOT change numbers, menu codes, emoji, line breaks, indentation, URLs, email addresses, " +
  "or phone numbers.\n" +
  "3. Keep WhatsApp formatting markers exactly (*bold*, _italic_) and keep them around the same words.\n" +
  "4. Keep the message the same length and structure. Do not add or remove lines.\n" +
  "5. Output ONLY the translated message, with no quotes and no explanation.";

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

async function jtgFetch(path: string, init: RequestInit, apiKey: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${JTG_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...(init.headers ?? {}), authorization: `Bearer ${apiKey}` },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function pickModel(apiKey: string): Promise<string | null> {
  const configured = process.env["JTG_AI_MODEL"];
  if (configured && configured.trim()) return configured.trim();
  const res = await jtgFetch("/models", { method: "GET" }, apiKey);
  if (!res.ok) throw new Error(`Gagal ambil daftar model (${res.status})`);
  const parsed = (await res.json()) as { data?: Array<{ id?: string }> };
  return parsed?.data?.find((m) => m?.id)?.id ?? null;
}

async function translateWithAi(source: string): Promise<string | null> {
  const apiKey = process.env["JTG_AI_API_KEY"];
  if (!apiKey) return null;
  try {
    const model = await pickModel(apiKey);
    if (!model) return null;
    const res = await jtgFetch(
      "/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: GLOSSARY_PROMPT },
            { role: "user", content: source },
          ],
          stream: false,
        }),
      },
      apiKey,
    );
    if (!res.ok) throw new Error(`ai.jtg.pro error ${res.status}`);
    const parsed = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const answer = parsed?.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
    return answer && answer.length > 0 ? answer : null;
  } catch (err) {
    console.error("Terjemahan AI gagal", err);
    return null;
  }
}

/**
 * Terjemahkan teks bot ke bahasa tujuan. Bahasa Indonesia dikembalikan apa adanya.
 * Hasil disimpan di cache; kegagalan apa pun -> teks asli (bot tetap menjawab).
 */
export async function translateBotText(
  source: string,
  language: BotLanguage,
  cacheKey?: string | null,
): Promise<string> {
  const text = source ?? "";
  if (language === "id" || text.trim().length === 0) return text;

  const key = cacheKey && cacheKey.trim() ? cacheKey.trim() : `text:${hash(text)}`;
  const sourceHash = hash(text);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cached } = await supabaseAdmin
      .from("bot_menu_translations")
      .select("body, source_hash")
      .eq("menu_path", key)
      .eq("language", language)
      .maybeSingle();
    if (cached && cached.source_hash === sourceHash && cached.body) return cached.body;

    const translated = await translateWithAi(text);
    if (!translated) return text;

    await supabaseAdmin
      .from("bot_menu_translations")
      .upsert(
        {
          menu_path: key,
          language,
          source_hash: sourceHash,
          body: translated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "menu_path,language" },
      );
    return translated;
  } catch (err) {
    console.error("Cache terjemahan gagal, memakai teks asli", err);
    const translated = await translateWithAi(text);
    return translated ?? text;
  }
}
