// Dukungan dua bahasa untuk chatbot WhatsApp: Indonesia (default) & English.
// Murni (tanpa I/O) supaya mudah diuji dan dipakai di sisi server mana pun.

export type BotLanguage = "id" | "en";

export const DEFAULT_LANGUAGE: BotLanguage = "id";

/** Perintah/menu untuk berpindah bahasa. */
const EN_COMMANDS = new Set([
  "9",
  "en",
  "eng",
  "english",
  "in english",
  "bahasa inggris",
  "english please",
  "switch to english",
  "change language to english",
]);

const ID_COMMANDS = new Set([
  "id",
  "ind",
  "indo",
  "indonesia",
  "bahasa",
  "bahasa indonesia",
  "in indonesian",
  "switch to indonesian",
  "ganti bahasa indonesia",
]);

export function toBotLanguage(value: string | null | undefined): BotLanguage {
  return value === "en" ? "en" : "id";
}

/** Bahasa yang diminta warga lewat perintah, atau null jika bukan perintah bahasa. */
export function detectLanguageCommand(text: string | null | undefined): BotLanguage | null {
  const normalized = (text ?? "").trim().toLowerCase().replace(/[!.?,]+$/g, "");
  if (EN_COMMANDS.has(normalized)) return "en";
  if (ID_COMMANDS.has(normalized)) return "id";
  return null;
}

/** Baris pilihan bahasa yang ditempelkan di bawah menu utama. */
export function languageFooter(language: BotLanguage): string {
  return language === "en"
    ? "\n\n🌐 Type *ID* for Bahasa Indonesia."
    : "\n\n🌐 Ketik *9* atau *EN* untuk English.";
}

/** Konfirmasi setelah bahasa diganti. */
export function languageSwitchNotice(language: BotLanguage): string {
  return language === "en"
    ? "Language switched to English. Indonesian terms for official documents are kept as they are, with the English meaning in brackets."
    : "Bahasa diubah ke Bahasa Indonesia.";
}

type Strings = {
  help: string;
  unknownPrefix: string;
  agentReply: string;
  notFound: string;
  waitNotice: string;
  closingSurvey: string;
  kbIntro: string;
  kbOptionsIntro: string;
  kbOptionsOutro: string;
};

const OPERATOR_CONTACT_ID =
  " Jika mendesak, Bapak/Ibu juga dapat menghubungi 0821-4027-3000 " +
  "(Layanan Pengaduan Masyarakat Pemerintah Kabupaten Purworejo).";

const OPERATOR_CONTACT_EN =
  " If it is urgent, you may also contact 0821-4027-3000 " +
  "(Layanan Pengaduan Masyarakat / Public Complaint Service of the Purworejo Regency Government).";

const TEXTS: Record<BotLanguage, Strings> = {
  id: {
    help:
      "❓ *Bantuan*\n\n" +
      "Balas dengan angka yang tertera untuk memilih layanan. Anda juga bisa mengetik pertanyaan dengan kalimat biasa.\n\n" +
      "Ketik *0* atau *Mulai ulang* untuk kembali ke awal, ketik *7* untuk berbicara dengan petugas, " +
      "atau ketik *9* untuk English.",
    unknownPrefix: "Maaf, pilihan tidak dikenali. Silakan pilih salah satu menu berikut.\n\n",
    agentReply:
      "Baik, permintaan Anda kami teruskan ke petugas layanan Kabupaten Purworejo. " +
      "Mohon tunggu, petugas kami akan segera membalas pesan ini." +
      OPERATOR_CONTACT_ID,
    notFound:
      "Maaf, saya belum menemukan jawaban untuk pertanyaan Anda. " +
      "Apakah Bapak/Ibu ingin saya sambungkan ke petugas kami? " +
      "Balas *YA* untuk terhubung ke operator, atau ketik pertanyaan lain / *menu* untuk kembali ke menu utama." +
      OPERATOR_CONTACT_ID,
    waitNotice: "Sebentar, saya cek informasinya dulu.",
    closingSurvey:
      "Apakah layanan kami sudah cukup membantu? Apakah ada lagi yang ingin Bapak/Ibu tanyakan? " +
      "Balas pesan ini kapan saja jika masih ada yang perlu dibantu.",
    kbIntro: "Berikut informasi terkait pertanyaan Anda:",
    kbOptionsIntro: "Ada beberapa informasi yang mungkin sesuai dengan pertanyaan Anda:",
    kbOptionsOutro:
      "Silakan balas dengan nomor pilihan di atas atau ketik kata kunci yang lebih spesifik.",
  },
  en: {
    help:
      "❓ *Help*\n\n" +
      "Reply with one of the numbers shown to pick a service. You can also just type your question in a normal sentence.\n\n" +
      "Type *0* or *Restart* to go back to the beginning, *7* to talk to an officer, " +
      "or *ID* to switch back to Bahasa Indonesia.",
    unknownPrefix: "Sorry, I did not recognise that option. Please pick one of the menus below.\n\n",
    agentReply:
      "Alright, your request has been forwarded to an officer of the Purworejo Regency public service. " +
      "Please wait a moment, our officer will reply to this chat shortly." +
      OPERATOR_CONTACT_EN,
    notFound:
      "Sorry, I could not find an answer to your question yet. " +
      "Would you like me to connect you with one of our officers? " +
      "Reply *YES* to be connected, or type another question / *menu* to go back to the main menu." +
      OPERATOR_CONTACT_EN,
    waitNotice: "One moment, let me check that information for you.",
    closingSurvey:
      "Was our service helpful enough? Is there anything else you would like to ask? " +
      "Just reply to this message any time you need more help.",
    kbIntro: "Here is the information related to your question:",
    kbOptionsIntro: "There are a few pieces of information that may match your question:",
    kbOptionsOutro:
      "Please reply with one of the numbers above, or type a more specific keyword.",
  },
};

export function botStrings(language: BotLanguage): Strings {
  return TEXTS[language];
}

/** Balasan setuju ("sambungkan ke petugas") dalam dua bahasa. */
const AFFIRMATIVE = new Set(["ya", "iya", "y", "boleh", "oke", "ok", "yes", "yeah", "sure", "please"]);

export function isAffirmativeIn(text: string | null | undefined): boolean {
  const normalized = (text ?? "").trim().toLowerCase().replace(/[!.?,]+$/g, "");
  return AFFIRMATIVE.has(normalized);
}
