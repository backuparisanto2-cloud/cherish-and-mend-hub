// Auto-reply chatbot Purworejo: navigasi menu & submenu memakai naskah resmi.
// Server-only. Menu angka dijawab dari naskah resmi; kalimat bebas dijawab AI + Knowledge Base.

import { PURWOREJO_CONTENT } from "./purworejo-content";
import {
  botStrings,
  languageFooter,
  toBotLanguage,
  type BotLanguage,
} from "./bot-language";
import { translateBotText } from "./bot-translate.server";
import { toWhatsAppText } from "./whatsapp-format";
import { loadConversationMemory, type MemoryTurn } from "./bot-memory.server";

const CHATERA_BASE_URL = "https://api.chatera.id/v1";

export const MAIN_MENU = PURWOREJO_CONTENT["utama"]!;

const GREETINGS = new Set([
  "halo",
  "hallo",
  "halo min",
  "hai",
  "hi",
  "hello",
  "p",
  "permisi",
  "pagi",
  "siang",
  "sore",
  "malam",
  "selamat pagi",
  "selamat siang",
  "selamat sore",
  "selamat malam",
  "assalamualaikum",
  "min",
  "admin",
  "cs",
]);

const HELP_COMMANDS = new Set(["8", "help", "bantuan", "tolong"]);
const RESET_COMMANDS = new Set([
  "0",
  "menu",
  "mulai",
  "mulai ulang",
  "start",
  "start over",
  "restart",
]);

export const HELP_REPLY = botStrings("id").help;

/** Normalisasi input warga menjadi kunci menu, mis. "3 . 10 . 1" -> "3.10.1". */
function toMenuKey(text: string): string {
  return text
    .trim()
    .replace(/[)\]]/g, "")
    .replace(/[^\d.]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

const CHILD_CODE = /\[(\d+(?:\.\d+)+)\]/g;

/** Ubah kode penuh submenu ([2.1]) menjadi nomor relatif ([1]) saat ditampilkan. */
export function relativizeMenu(body: string): string {
  return body.replace(CHILD_CODE, (_m, code: string) => `[${code.split(".").pop()}]`);
}

/**
 * Peta navigasi eksplisit per layar menu:
 * - children: path anak yang BENAR-BENAR ditawarkan pada layar itu.
 * - back: satu path tujuan tombol "kembali" yang tertulis pada layar itu.
 * Input warga hanya boleh dicocokkan ke dua daftar ini, tidak pernah ditebak
 * dengan menggabung path ke seluruh isi PURWOREJO_CONTENT.
 */
export type MenuNode = { children: string[]; back: string | null };

const BACK_CODE = /Ketik \*(\d+(?:\.\d+)*)\* untuk kembali/g;

function buildMenuGraph(): Record<string, MenuNode> {
  const graph: Record<string, MenuNode> = {};
  for (const [key, body] of Object.entries(PURWOREJO_CONTENT)) {
    if (key === "utama") continue;
    const children: string[] = [];
    CHILD_CODE.lastIndex = 0;
    for (const m of body.matchAll(CHILD_CODE)) {
      const code = m[1]!;
      if (code.startsWith(`${key}.`) && code.split(".").length === key.split(".").length + 1) {
        children.push(code);
      }
    }
    let back: string | null = null;
    BACK_CODE.lastIndex = 0;
    for (const m of body.matchAll(BACK_CODE)) {
      const target = m[1]!;
      if (target !== "0" && target !== key && PURWOREJO_CONTENT[target]) back = target;
    }
    graph[key] = { children, back };
  }
  // Menu utama: anak = kategori level 1, tanpa tombol kembali.
  graph["utama"] = {
    children: Object.keys(PURWOREJO_CONTENT).filter((k) => /^\d+$/.test(k)),
    back: null,
  };
  return graph;
}

export const MENU_GRAPH: Record<string, MenuNode> = buildMenuGraph();

function nodeFor(currentMenuPath: string | null): MenuNode {
  return (currentMenuPath && MENU_GRAPH[currentMenuPath]) || MENU_GRAPH["utama"]!;
}

export type AutoReply = { reply: string; menuPath: string | null };

function show(key: string): AutoReply {
  return { reply: relativizeMenu(PURWOREJO_CONTENT[key]!), menuPath: key };
}

/** Menentukan balasan otomatis untuk sebuah pesan warga (nomor relatif didukung). */
export function resolveAutoReply(
  text: string | null | undefined,
  currentMenuPath: string | null = null,
  language: BotLanguage = "id",
): AutoReply {
  const unknownPrefix = botStrings(toBotLanguage(language)).unknownPrefix;
  const normalized = (text ?? "").trim().toLowerCase();
  if (HELP_COMMANDS.has(normalized)) {
    return { reply: HELP_REPLY, menuPath: currentMenuPath };
  }
  if (RESET_COMMANDS.has(normalized)) return { reply: MAIN_MENU, menuPath: null };
  if (GREETINGS.has(normalized)) return { reply: MAIN_MENU, menuPath: null };

  const key = toMenuKey(normalized);
  if (key === "0" || key === "") return { reply: MAIN_MENU, menuPath: null };

  const current = currentMenuPath && PURWOREJO_CONTENT[currentMenuPath] ? currentMenuPath : null;
  const node = nodeFor(current);

  // 1. Pilihan anak yang memang ditampilkan di layar ini (nomor relatif / kode penuh).
  const child = node.children.find(
    (c) => c === key || c.split(".").pop() === key,
  );
  if (child) return show(child);

  // 2. Angka "kembali" yang memang ditawarkan pada layar ini.
  if (node.back && node.back === key) return show(node.back);

  // 3. Tidak dikenali: tampilkan ulang layar yang sedang aktif, tanpa menebak.
  if (current) {
    return { reply: unknownPrefix + relativizeMenu(PURWOREJO_CONTENT[current]!), menuPath: current };
  }
  return { reply: unknownPrefix + MAIN_MENU, menuPath: null };
}


// ---------------------------------------------------------------------------
// Pencarian Knowledge Base (tanpa AI/LLM): skoring keyword sederhana.
// ---------------------------------------------------------------------------

const ESCALATION_WORDS = [
  "operator",
  "petugas",
  "komplain",
  "keluhan serius",
  "tidak puas",
  "gak puas",
  "kecewa",
  "marah",
  "lambat sekali",
  "lapor pimpinan",
  "manusia",
];

const STOPWORDS = new Set([
  "yang","dan","di","ke","dari","untuk","apa","apakah","bagaimana","gimana","kenapa","mengapa",
  "saya","aku","kami","kita","anda","ini","itu","ada","tidak","gak","nggak","belum","sudah","udah",
  "mau","ingin","bisa","boleh","tolong","mohon","pak","bu","min","admin","ya","yah","kok","sih",
  "dong","deh","aja","saja","juga","dengan","pada","atau","kalau","kalo","jadi","nya","tapi","masih",
  "cara","info","informasi","mengenai",
  "banget","sekali","lagi","punya","dapat","harus","akan","oleh","dalam","tentang","seperti","biar",
]);

/** true kalau input persis berupa key menu/greeting yang dikenali. */
export function isMenuInput(
  text: string | null | undefined,
  currentMenuPath: string | null = null,
): boolean {
  const normalized = (text ?? "").trim().toLowerCase();
  if (normalized === "") return true;
  if (GREETINGS.has(normalized) || HELP_COMMANDS.has(normalized) || RESET_COMMANDS.has(normalized)) {
    return true;
  }
  const cleaned = normalized.replace(/[)\]\s]/g, "");
  // Semua input berupa angka ditangani navigasi menu (termasuk angka yang tidak
  // ditawarkan di layar aktif -> dijawab "pilihan tidak dikenali" + menu ulang).
  return /^\d+(\.\d+)*$/.test(cleaned);
}

export function needsAgent(text: string | null | undefined): boolean {
  const t = (text ?? "").toLowerCase();
  return ESCALATION_WORDS.some((w) => t.includes(w));
}

const OPERATOR_CONTACT =
  " Jika mendesak, Bapak/Ibu juga dapat menghubungi 0821-4027-3000 " +
  "(Layanan Pengaduan Masyarakat Pemerintah Kabupaten Purworejo).";

export const NOT_FOUND_REPLY =
  "Maaf, saya belum menemukan jawaban untuk pertanyaan Anda. " +
  "Apakah Bapak/Ibu ingin saya sambungkan ke petugas kami? " +
  "Balas *YA* untuk terhubung ke operator, atau ketik pertanyaan lain / *menu* untuk kembali ke menu utama." +
  OPERATOR_CONTACT;

/** Balasan setuju yang dianggap konfirmasi "sambungkan ke petugas". */
const AFFIRMATIVE_REPLIES = new Set(["ya", "iya", "y", "boleh", "oke", "ok"]);

export function isAffirmativeReply(text: string | null | undefined): boolean {
  const normalized = (text ?? "").trim().toLowerCase().replace(/[!.?,]+$/g, "");
  return AFFIRMATIVE_REPLIES.has(normalized);
}

export const AGENT_REPLY =
  "Baik, permintaan Anda kami teruskan ke petugas layanan Kabupaten Purworejo. " +
  "Mohon tunggu, petugas kami akan segera membalas pesan ini." +
  OPERATOR_CONTACT;

/** Pesan penutup + survei kepuasan setelah percakapan ditandai selesai. */
export const CLOSING_SURVEY_TEXT =
  "Apakah layanan kami sudah cukup membantu? Apakah ada lagi yang ingin Bapak/Ibu tanyakan? " +
  "Balas pesan ini kapan saja jika masih ada yang perlu dibantu.";

export function tokenize(text: string): string[] {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

type KbEntry = { title: string; answer: string; keywords: string[]; category?: string | null };

export function scoreEntry(tokens: string[], entry: KbEntry): number {
  const keywords = (entry.keywords ?? []).map((k) => k.toLowerCase());
  const title = (entry.title ?? "").toLowerCase();
  const answer = (entry.answer ?? "").toLowerCase();
  let score = 0;
  for (const token of new Set(tokens)) {
    if (keywords.some((k) => k === token || k.split(/\s+/).includes(token))) score += 3;
    if (title.includes(token)) score += 2;
    if (answer.includes(token)) score += 1;
  }
  return score;
}

const MIN_SCORE = 2;

/** Ambil seluruh entri knowledge base yang aktif. */
async function loadActiveKbEntries(): Promise<KbEntry[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("knowledge_base")
    .select("title, answer, keywords, category")
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []) as KbEntry[];
}

/** Cari jawaban di knowledge_base berdasarkan skoring kata kunci. */
export async function resolveKnowledgeReply(
  text: string,
  language: BotLanguage = "id",
): Promise<{
  reply: string;
  escalate: boolean;
  matchedCategory?: string | null;
  notFound?: boolean;
}> {
  const lang = toBotLanguage(language);
  const strings = botStrings(lang);
  const tokens = tokenize(text);
  if (tokens.length === 0) return { reply: strings.notFound, escalate: false, notFound: true };

  let entries: KbEntry[] = [];
  try {
    entries = await loadActiveKbEntries();
  } catch (err) {
    console.error("Gagal memuat knowledge_base", err);
    return { reply: strings.notFound, escalate: true };
  }

  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(tokens, entry) }))
    .filter((s) => s.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // Hanya pesan ambigu satu kata bermakna yang dianggap sapaan -> menu utama.
    // Pesan 2+ kata bermakna yang tidak cocok KB mana pun dapat jawaban
    // "tidak ditemukan" yang singkat, bukan banner menu utama berulang.
    if (tokens.length <= 1) {
      const menu = await translateBotText(MAIN_MENU, lang, "menu:utama");
      return { reply: menu + languageFooter(lang), escalate: false };
    }
    return { reply: strings.notFound, escalate: false, notFound: true };
  }

  const top = scored[0]!;
  const close = scored.filter((s) => top.score - s.score <= 1).slice(0, 3);

  if (close.length > 1) {
    const options = close.map((s, i) => `${i + 1}. ${s.entry.title}`).join("\n");
    return {
      reply: `${strings.kbOptionsIntro}\n\n${options}\n\n${strings.kbOptionsOutro}`,
      escalate: false,
    };
  }

  const answer = await translateBotText(top.entry.answer, lang, `kb:${top.entry.title}`);
  return {
    reply: `${strings.kbIntro}\n\n${answer}`,
    escalate: false,
    matchedCategory: top.entry.category ?? null,
  };
}

// ---------------------------------------------------------------------------
// Mesin jawaban alternatif: AI eksternal (Open WebUI ai.jtg.pro).
// ---------------------------------------------------------------------------

const JTG_BASE_URL = "https://ai.jtg.pro/api";
const AI_TIMEOUT_MS = 7_000;
const AI_GREETING_TIMEOUT_MS = 4_000;

/** "Soul" chatbot: humble, jelas, melayani. Dipakai di semua jawaban AI. */
export const AI_PERSONA =
  "Karaktermu: HUMBLE (rendah hati, ramah, tidak menggurui, tidak sok tahu), " +
  "JELAS (akurat, mudah dipahami, terstruktur, tidak bertele-tele), " +
  "MELAYANI (responsif, sabar, solutif, berorientasi pada kebutuhan warga). " +
  "Gaya bahasa: Bahasa Indonesia sehari-hari yang sederhana, hangat, dan sopan; " +
  "jangan terdengar seperti template atau membaca naskah. " +
  "Panjang jawaban proporsional: pertanyaan singkat dijawab singkat. " +
  "Tutup dengan satu kalimat ajakan lanjut yang wajar supaya percakapan tidak menggantung.";

const AI_SYSTEM_PROMPT =
  "Kamu asisten chatbot resmi layanan publik Pemerintah Kabupaten Purworejo. " +
  AI_PERSONA +
  " Jawab HANYA berdasarkan informasi yang diberikan, singkat (di bawah 500 karakter). " +
  "Kalau info tidak tersedia, katakan akan disambungkan ke petugas.";

/** Aturan tambahan saat warga memilih bahasa Inggris. */
const AI_ENGLISH_RULES =
  "ANSWER IN NATURAL ENGLISH. Keep the Indonesian name of every government document, " +
  "institution, programme, and service exactly as written (KTP, Kartu Keluarga, KIA, " +
  "Akta Kelahiran, NIK, PBB, Dukcapil, Puskesmas, RSUD, DPMPTSP, PORJO, Kecamatan, Desa), " +
  "and add the English meaning in brackets on the FIRST mention only, e.g. " +
  "\"Kartu Keluarga (Family Card)\". Keep URLs, emails, and phone numbers unchanged.";

/** Aturan pemakaian memori percakapan (beberapa giliran terakhir). */
const AI_MEMORY_RULES =
  "Kamu diberi riwayat singkat percakapan ini. Gunakan riwayat itu sebagai ingatan: " +
  "ingat nama warga, dokumen/layanan yang sedang dibahas, dan data yang sudah disebutkan, " +
  "supaya pertanyaan lanjutan yang singkat (misalnya \"kalau belum punya?\", \"biayanya?\", " +
  "\"di mana?\") dijawab sesuai topik terakhir. Jangan menanyakan ulang hal yang sudah dijawab warga, " +
  "dan jangan mengulang sapaan bila percakapan sudah berjalan. " +
  "Jangan mengarang informasi yang tidak ada di riwayat maupun di informasi resmi.";

export type BotEngine = "keyword" | "ai_external";

/** Baca mesin jawaban yang dipilih Owner di halaman Pengaturan. */
export async function getBotEngine(): Promise<BotEngine> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("bot_engine")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { bot_engine?: string } | null)?.bot_engine === "ai_external"
      ? "ai_external"
      : "keyword";
  } catch (err) {
    console.error("Gagal membaca bot_engine, memakai keyword", err);
    return "keyword";
  }
}

async function jtgFetch(
  path: string,
  init: RequestInit,
  apiKey: string,
  timeoutMs: number = AI_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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

/** Ambil model pertama yang tersedia di instance Open WebUI. */
async function pickModel(apiKey: string): Promise<string | null> {
  const configured = process.env["JTG_AI_MODEL"];
  if (configured && configured.trim()) return configured.trim();
  const res = await jtgFetch("/models", { method: "GET" }, apiKey);
  if (!res.ok) throw new Error(`Gagal ambil daftar model (${res.status})`);
  const parsed = (await res.json()) as { data?: Array<{ id?: string }> };
  return parsed?.data?.find((m) => m?.id)?.id ?? null;
}

/**
 * Jawab pertanyaan bebas memakai AI eksternal dengan konteks Knowledge Base terpilih.
 * Gagal/timeout apa pun -> otomatis fallback ke pencarian kata kunci.
 */
export async function resolveAiReply(
  text: string,
  language: BotLanguage = "id",
  memory: MemoryTurn[] = [],
): Promise<{
  reply: string;
  escalate: boolean;
  matchedCategory?: string | null;
  notFound?: boolean;
}> {
  const apiKey = process.env["JTG_AI_API_KEY"];
  if (!apiKey) {
    console.error("JTG_AI_API_KEY belum diatur, fallback ke pencarian kata kunci");
    return resolveKnowledgeReply(text, language);
  }

  try {
    const tokens = tokenize(text);
    const entries = await loadActiveKbEntries();
    const ranked = entries
      .map((entry) => ({ entry, score: scoreEntry(tokens, entry) }))
      .sort((a, b) => b.score - a.score);
    const relevant = ranked.filter((s) => s.score > 0).slice(0, 8);
    const context = (relevant.length > 0 ? relevant : ranked.slice(0, 5))
      .map((s) => `- ${s.entry.title}: ${s.entry.answer}`)
      .join("\n");

    const model = await pickModel(apiKey);
    if (!model) throw new Error("Tidak ada model tersedia di ai.jtg.pro");

    const res = await jtgFetch(
      "/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                `${AI_SYSTEM_PROMPT}${language === "en" ? `\n\n${AI_ENGLISH_RULES}` : ""}` +
                (memory.length > 0 ? `\n\n${AI_MEMORY_RULES}` : "") +
                `\n\nInformasi resmi:\n${context}`,
            },
            ...memory.map((turn) => ({ role: turn.role, content: turn.content })),
            { role: "user", content: text },
          ],
          stream: false,
        }),
      },
      apiKey,
    );
    if (!res.ok) throw new Error(`ai.jtg.pro error ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const parsed = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = parsed?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error("Balasan AI kosong");

    return {
      reply: answer,
      escalate: false,
      matchedCategory: relevant[0]?.entry.category ?? null,
    };
  } catch (err) {
    console.error("AI eksternal gagal, fallback ke kata kunci", err);
    return resolveKnowledgeReply(text, language);
  }
}

// ---------------------------------------------------------------------------
// Sapaan personal: AI menyusun satu kalimat sapaan memakai nama WhatsApp warga.
// ---------------------------------------------------------------------------

/** Pesan tunggu bila jawaban belum siap dalam beberapa detik. */
export const WAIT_NOTICE = "Sebentar, saya cek informasinya dulu.";

/** true bila pesan warga berupa sapaan/pembuka percakapan. */
export function isGreeting(text: string | null | undefined): boolean {
  return GREETINGS.has((text ?? "").trim().toLowerCase());
}

export function isHelpRequest(text: string | null | undefined): boolean {
  return HELP_COMMANDS.has((text ?? "").trim().toLowerCase());
}

export function isStartOverRequest(text: string | null | undefined): boolean {
  return RESET_COMMANDS.has((text ?? "").trim().toLowerCase());
}

/** Nama panggilan yang wajar dari username WhatsApp (satu-dua kata pertama). */
export function toDisplayName(name: string | null | undefined): string | null {
  const cleaned = (name ?? "")
    .replace(/[^\p{L}\p{N}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  if (/^\+?\d[\d\s-]*$/.test(cleaned)) return null; // nomor telepon, bukan nama
  const parts = cleaned.split(" ").slice(0, 2).join(" ");
  return parts.length > 30 ? parts.slice(0, 30).trim() : parts;
}

/** Bagian hari menurut waktu Purworejo (WIB). */
function timeOfDay(now = new Date()): "pagi" | "siang" | "sore" | "malam" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  if (hour >= 4 && hour < 11) return "pagi";
  if (hour >= 11 && hour < 15) return "siang";
  if (hour >= 15 && hour < 18) return "sore";
  return "malam";
}

const TIME_OF_DAY_EN: Record<string, string> = {
  pagi: "morning",
  siang: "day",
  sore: "afternoon",
  malam: "evening",
};

function fallbackGreeting(name: string | null, language: BotLanguage = "id"): string {
  if (language === "en") {
    const part = TIME_OF_DAY_EN[timeOfDay()] ?? "day";
    return name
      ? `Good ${part}, ${name}. How may I help you today?`
      : `Hello and good ${part}. I am ready to help—what service do you need?`;
  }
  const sapaan = `Selamat ${timeOfDay()}`;
  return name
    ? `${sapaan}, ${name}. Ada yang bisa saya bantu hari ini?`
    : `Halo, ${sapaan.toLowerCase()}. Saya siap membantu—layanan apa yang Anda perlukan?`;
}

/** Sapaan personal singkat dari AI; gagal/timeout -> sapaan siap-pakai. */
export async function resolveGreeting(
  name: string | null | undefined,
  language: BotLanguage = "id",
): Promise<string> {
  const displayName = toDisplayName(name);
  const apiKey = process.env["JTG_AI_API_KEY"];
  if (!apiKey) return fallbackGreeting(displayName, language);

  try {
    const model = await pickModel(apiKey);
    if (!model) throw new Error("Tidak ada model tersedia di ai.jtg.pro");

    const res = await jtgFetch(
      "/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Kamu asisten chatbot resmi layanan publik Pemerintah Kabupaten Purworejo. " +
                AI_PERSONA +
                " Tugasmu sekarang HANYA menulis satu sapaan pembuka, maksimal dua kalimat pendek, " +
                "tanpa daftar menu, tanpa emoji berlebihan, tanpa tanda kutip." +
                (language === "en"
                  ? " TULIS SAPAAN DALAM BAHASA INGGRIS yang natural dan sopan."
                  : ""),
            },
            {
              role: "user",
              content:
                `Waktu setempat: ${timeOfDay()}. ` +
                (displayName
                  ? `Nama warga: ${displayName}. Sapa dia dengan namanya secara natural dan sopan, ` +
                    "lalu tawarkan bantuan."
                  : "Nama warga tidak diketahui. Sapa dengan sopan tanpa menyebut nama, lalu tawarkan bantuan."),
            },
          ],
          stream: false,
        }),
      },
      apiKey,
      AI_GREETING_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`ai.jtg.pro error ${res.status}`);
    const parsed = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = parsed?.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "");
    if (!answer || answer.length > 240) throw new Error("Sapaan AI tidak layak");
    return answer;
  } catch (err) {
    console.error("Sapaan AI gagal, memakai sapaan bawaan", err);
    return fallbackGreeting(displayName, language);
  }
}

/** Menu utama sesuai bahasa percakapan + baris pilihan bahasa. */
export async function localizedMainMenu(language: BotLanguage): Promise<string> {
  const body = await translateBotText(MAIN_MENU, language, "menu:utama");
  return body + languageFooter(language);
}

/** Pilih balasan: menu angka seperti semula, selain itu cari di Knowledge Base. */
export async function resolveReply(
  text: string | null | undefined,
  currentMenuPath: string | null = null,
  senderName: string | null = null,
  language: BotLanguage = "id",
  chateraConversationId: string | null = null,
): Promise<{
  messages: string[];
  reply: string;
  escalate: boolean;
  matchedCategory?: string | null;
  menuPath?: string | null | undefined;
  notFound?: boolean;
}> {
  const lang = toBotLanguage(language);
  const strings = botStrings(lang);

  if (needsAgent(text)) {
    return { messages: [strings.agentReply], reply: strings.agentReply, escalate: true };
  }

  if (isStartOverRequest(text)) {
    const menu = await localizedMainMenu(lang);
    return { messages: [menu], reply: menu, escalate: false, menuPath: null };
  }

  if (isHelpRequest(text)) {
    return {
      messages: [strings.help],
      reply: strings.help,
      escalate: false,
      menuPath: currentMenuPath,
    };
  }

  // Sapaan pembuka: satu pesan sapaan personal, lalu menu layanan menyusul.
  if (isGreeting(text)) {
    const greeting = await resolveGreeting(senderName, lang);
    const menu = await localizedMainMenu(lang);
    return { messages: [greeting, menu], reply: menu, escalate: false, menuPath: null };
  }

  let result: {
    reply: string;
    escalate: boolean;
    matchedCategory?: string | null;
    menuPath?: string | null;
    notFound?: boolean;
  };
  if (isMenuInput(text, currentMenuPath)) {
    const { reply, menuPath } = resolveAutoReply(text, currentMenuPath, lang);
    const unknown = reply.startsWith(strings.unknownPrefix);
    const core = unknown ? reply.slice(strings.unknownPrefix.length) : reply;
    const prefix = unknown ? strings.unknownPrefix : "";
    if (core === MAIN_MENU) {
      const menu = await localizedMainMenu(lang);
      result = { reply: prefix + menu, escalate: false, menuPath: null };
    } else {
      const body = await translateBotText(core, lang, menuPath ? `menu:${menuPath}` : null);
      result = { reply: prefix + body, escalate: false, menuPath };
    }
  } else {
    const question = (text ?? "").trim();
    const engine = await getBotEngine();
    // Di menu utama (belum masuk sub-menu), pertanyaan bebas warga selalu
    // dikirim ke AI eksternal JTG; kegagalan otomatis fallback ke kata kunci.
    const atMainMenu = !currentMenuPath;
    result =
      engine === "ai_external" || atMainMenu
        ? await resolveAiReply(question, lang)
        : await resolveKnowledgeReply(question, lang);
  }

  return { ...result, messages: [result.reply] };
}

/** Kirim pesan penutup/survei sekali saja untuk percakapan yang sudah ditutup. */
export async function sendClosingSurvey(chateraConversationId: string | null): Promise<void> {
  if (!chateraConversationId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, contact_id, survey_sent_at, language")
    .eq("chatera_conversation_id", chateraConversationId)
    .maybeSingle();
  if (!conversation || conversation.survey_sent_at || !conversation.contact_id) return;

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("wa_number, channel_id")
    .eq("id", conversation.contact_id)
    .maybeSingle();
  const phone = contact?.wa_number;
  if (!phone) return;

  // Klaim pengiriman secara atomik supaya tidak terkirim dua kali.
  const { data: claimed } = await supabaseAdmin
    .from("conversations")
    .update({ survey_sent_at: new Date().toISOString() })
    .eq("id", conversation.id)
    .is("survey_sent_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return;

  const language = toBotLanguage(
    (conversation as { language?: string | null }).language ?? null,
  );

  await sendBotReply({
    to: phone,
    text: botStrings(language).closingSurvey,
    conversationId: chateraConversationId,
    channelId: contact?.channel_id ?? null,
  });
}


type SendContext = {
  to: string;
  text: string;
  conversationId?: string | null;
  channelId?: string | null;
  matchedCategory?: string | null;
};

const SERVICE_MENU_INTERACTIVE = {
  type: "list",
  header: { type: "text", text: "Layanan Purworejo" },
  body: { text: "Silakan pilih layanan yang Anda butuhkan. Anda juga bisa mengetik pertanyaan langsung." },
  footer: { text: "Pilih satu opsi atau balas angkanya" },
  action: {
    button: "Pilih Layanan",
    sections: [
      {
        title: "Layanan",
        rows: [
          { id: "1", title: "1. Aduan & Aspirasi", description: "PORJO dan layanan pengaduan warga" },
          { id: "2", title: "2. Layanan Kesehatan", description: "RSUD dan Puskesmas" },
          { id: "3", title: "3. Kependudukan", description: "KK, KIA, pindah, dan dokumen warga" },
          { id: "4", title: "4. Perizinan & Usaha", description: "DPMPTSP dan layanan perizinan" },
          { id: "5", title: "5. Pajak Daerah", description: "PBB dan layanan pajak daerah" },
          { id: "6", title: "6. CCTV Purworejo", description: "Pantau CCTV publik melalui Lekjo" },
          { id: "7", title: "7. Hubungi Operator", description: "Bicara dengan petugas layanan" },
          { id: "8", title: "8. Bantuan", description: "Panduan memilih dan memakai layanan" },
          { id: "9", title: "9. English", description: "Switch this chat to English" },
          { id: "0", title: "0. Mulai Ulang", description: "Kembali ke menu layanan awal" },
        ],
      },
    ],
  },
} as const;

function outboundBody(ctx: SendContext, isMainMenu: boolean): Record<string, unknown> {
  const channel = ctx.channelId ? { channel_id: ctx.channelId } : {};
  if (isMainMenu) {
    return { type: "interactive", to: ctx.to, ...channel, interactive: SERVICE_MENU_INTERACTIVE };
  }
  return { type: "text", to: ctx.to, ...channel, text: { body: ctx.text } };
}

/** Kirim balasan lewat Chatera API lalu simpan sebagai pesan outbound. */
export async function sendBotReply(context: SendContext): Promise<void> {
  const apiKey = process.env["CHATERA_API_KEY"];
  if (!apiKey) {
    console.error("CHATERA_API_KEY belum diatur, auto-reply dilewati");
    return;
  }

  // Semua teks keluar dinormalkan agar tautan, email, dan nomor telepon aktif.
  const isMainMenu = context.text.startsWith(MAIN_MENU);
  const ctx: SendContext = { ...context, text: toWhatsAppText(context.text) };

  let messageId: string | null = null;
  try {
    let response = await fetch(`${CHATERA_BASE_URL}/whatsapp/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(outboundBody(ctx, isMainMenu)),
    });
    let raw = await response.text();
    // Jika pesan interaktif ditolak oleh kanal lama, menu teks tetap dikirim agar
    // warga tidak kehilangan navigasi.
    if (!response.ok && isMainMenu) {
      response = await fetch(`${CHATERA_BASE_URL}/whatsapp/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          type: "text",
          to: ctx.to,
          ...(ctx.channelId ? { channel_id: ctx.channelId } : {}),
          text: { body: ctx.text },
        }),
      });
      raw = await response.text();
    }
    if (!response.ok) {
      console.error("Auto-reply gagal dikirim", response.status, raw.slice(0, 500));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const d = (parsed?.["data"] ?? {}) as Record<string, unknown>;
      messageId = (d["messageId"] ?? d["id"] ?? parsed?.["messageId"] ?? null) as string | null;
    } catch {
      messageId = null;
    }
  } catch (err) {
    console.error("Auto-reply gagal menghubungi Chatera", err);
    return;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordOutboundMessage } = await import("@/lib/chatera-events.server");
    await recordOutboundMessage(supabaseAdmin, {
      conversationId: ctx.conversationId ?? null,
      phone: ctx.to,
      text: ctx.text,
      messageId,
      senderType: "bot",
      channelId: ctx.channelId ?? null,
      matchedCategory: ctx.matchedCategory ?? null,
    });
    await supabaseAdmin.from("chatera_messages").insert({
      delivery_id: `outbound:${messageId ?? crypto.randomUUID()}`,
      event_type: "message.outbound",
      direction: "outbound",
      message_id: messageId,
      conversation_id: ctx.conversationId ?? null,
      channel_id: ctx.channelId ?? null,
      sender_phone: ctx.to,
      sender_name: "Chatbot Purworejo",
      content_text: ctx.text,
      event_timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gagal menyimpan balasan bot", err);
  }
}

// ---------------------------------------------------------------------------
// Efek mengetik: jeda singkat & proporsional sebelum tiap pesan bot.
// ---------------------------------------------------------------------------

const TYPING_MS_PER_CHAR = 35;
const TYPING_MIN_MS = 500;
const TYPING_MAX_MS = 2_500;

/** Lama "sedang mengetik" untuk sebuah pesan, proporsional dengan panjangnya. */
export function typingDelayFor(text: string): number {
  const length = (text ?? "").trim().length;
  return Math.min(TYPING_MAX_MS, Math.max(TYPING_MIN_MS, length * TYPING_MS_PER_CHAR));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Kirim sinyal "sedang mengetik" ke WhatsApp bila Chatera mendukung. */
async function sendTypingIndicator(to: string, apiKey: string): Promise<void> {
  try {
    const res = await fetch(`${CHATERA_BASE_URL}/whatsapp/typing`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ to, state: "typing" }),
    });
    if (!res.ok && res.status !== 404 && res.status !== 405) {
      console.warn("Sinyal mengetik ditolak Chatera", res.status);
    }
  } catch {
    // Endpoint typing opsional: efek tetap terasa lewat jeda antar pesan.
  }
}

/** Kirim beberapa pesan berurutan dengan jeda mengetik yang wajar. */
export async function sendBotMessages(
  ctx: Omit<SendContext, "text">,
  messages: string[],
): Promise<void> {
  const apiKey = process.env["CHATERA_API_KEY"];
  const list = messages.filter((m) => (m ?? "").trim().length > 0);
  for (let i = 0; i < list.length; i++) {
    const text = list[i]!;
    if (apiKey) await sendTypingIndicator(ctx.to, apiKey);
    await sleep(typingDelayFor(text));
    await sendBotReply({ ...ctx, text });
  }
}


