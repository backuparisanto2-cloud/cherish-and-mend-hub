// Sanitizer teks keluar untuk WhatsApp.
// Murni (tanpa I/O) supaya mudah diuji: markdown diubah ke format WhatsApp,
// lalu URL / email / nomor telepon dinormalkan agar otomatis bisa diklik.

/** Nomor Indonesia -> format internasional +62 supaya WhatsApp menautkannya. */
export function normalizePhoneDigits(raw: string): string {
  const digits = (raw.match(/\d+/g) ?? []).join("");
  if (!digits) return raw;
  if (digits.startsWith("62")) return `+${digits}`;
  if (digits.startsWith("0")) return `+62${digits.slice(1)}`;
  return `+${digits}`;
}

// Ponsel Indonesia: 08xx / +628xx / 628xx dengan pemisah spasi, titik, atau strip.
const MOBILE = /(?<![\d+])(?:\+?62[\s.-]?8|08)\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}(?:[\s.-]?\d{1,4})?(?!\d)/g;
// Telepon kantor dengan kode area dalam tanda kurung, mis. (0275) 321010.
const LANDLINE = /\((0\d{2,4})\)\s?(\d{5,8})/g;

/** Normalisasi semua nomor telepon di dalam teks menjadi +62…. */
export function normalizePhones(text: string): string {
  return text
    .replace(LANDLINE, (_m, area: string, rest: string) => normalizePhoneDigits(`${area}${rest}`))
    .replace(MOBILE, (match) => normalizePhoneDigits(match));
}

/**
 * Ubah teks/markdown menjadi teks WhatsApp yang tautannya aktif:
 * - `[Label](https://…)` -> `Label: https://…`
 * - `**tebal**` -> `*tebal*`, judul `#` -> baris tebal, `- ` -> `• `
 * - `mailto:`/`tel:` dilepas, `www.` diberi `https://`
 * - nomor telepon dinormalkan ke +62
 */
export function toWhatsAppText(input: string | null | undefined): string {
  let out = (input ?? "").replace(/\r\n/g, "\n");

  // Tautan markdown -> "Label: url" (URL mentah selalu ikut tampil agar bisa diklik).
  out = out.replace(
    /\[([^\]\n]+)\]\(\s*((?:https?:\/\/|mailto:|tel:)[^\s)]+)\s*\)/g,
    (_m, label: string, url: string) => {
      const clean = url.replace(/^mailto:/i, "").replace(/^tel:/i, "");
      const target = /^tel:/i.test(url) ? normalizePhoneDigits(clean) : clean;
      const text = label.trim();
      return text && text !== target ? `${text}: ${target}` : target;
    },
  );

  // Autolink bergaya <https://…>
  out = out.replace(/<((?:https?:\/\/|mailto:|tel:)[^>\s]+)>/g, "$1");

  // Penekanan markdown -> penekanan WhatsApp.
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, "*_$1_*");
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
  out = out.replace(/(^|[\s(])__([^_\n]+)__/g, "$1*$2*");
  out = out.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, "*$1*");
  out = out.replace(/^(\s*)[-+]\s+(?=\S)/gm, "$1• ");

  // Skema teknis dilepas supaya WhatsApp menampilkan email/telepon polos.
  out = out.replace(/\bmailto:([^\s>]+)/gi, "$1");
  out = out.replace(/\btel:([+\d][\d\s.-]*)/gi, (_m, num: string) => normalizePhoneDigits(num));

  // URL tanpa skema.
  out = out.replace(/(^|[\s(])(www\.[^\s)]+)/g, (_m, pre: string, url: string) => `${pre}https://${url}`);

  return normalizePhones(out).replace(/[ \t]+$/gm, "");
}
