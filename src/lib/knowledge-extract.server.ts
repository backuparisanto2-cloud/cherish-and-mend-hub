// Server-only: ekstraksi teks dari dokumen kantor + pemecahan menjadi bagian (chunk).

export type ExtractedSection = { heading: string | null; text: string };
export type KnowledgeChunk = { title: string; answer: string; keywords: string[] };

const MAX_WORDS = 400;
const MIN_WORDS = 20;

export function detectFileType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ext;
}

export async function extractSections(bytes: Uint8Array, fileType: string): Promise<ExtractedSection[]> {
  switch (fileType) {
    case "pdf":
      return extractPdf(bytes);
    case "docx":
      return extractDocx(bytes);
    case "xlsx":
    case "xls":
    case "csv":
      return extractSheet(bytes);
    case "pptx":
      return extractPptx(bytes);
    case "doc":
    case "ppt":
      throw new Error(
        `Format .${fileType} (Office 97-2003) belum didukung. Simpan ulang sebagai .${fileType}x lalu unggah kembali.`,
      );
    default:
      throw new Error(`Tipe file .${fileType} tidak didukung.`);
  }
}

async function extractPdf(bytes: Uint8Array): Promise<ExtractedSection[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(text) ? text : [text];
  const sections: ExtractedSection[] = [];
  pages.forEach((pageText, index) => {
    const cleaned = normalizeText(pageText);
    if (cleaned) sections.push(...splitByHeadings(cleaned, `Halaman ${index + 1}`));
  });
  return sections;
}

async function extractDocx(bytes: Uint8Array): Promise<ExtractedSection[]> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = await mammoth.convertToHtml({ buffer });
  return sectionsFromHtml(result.value);
}

/** Ekstraksi teks dari halaman web: buang bagian non-konten lalu pecah per heading. */
export function extractWebPageSections(html: string): { title: string | null; sections: ExtractedSection[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeHtml(titleMatch[1] ?? "").replace(/\s+/g, " ").trim() || null : null;

  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header|aside)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");

  // Utamakan konten utama bila ada penanda yang jelas.
  const main =
    cleaned.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    cleaned.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (main?.[1] && main[1].replace(/<[^>]+>/g, " ").trim().length > 200) cleaned = main[1];

  return { title, sections: sectionsFromHtml(cleaned) };
}

function sectionsFromHtml(html: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    const text = normalizeText(buffer.join("\n"));
    if (text) sections.push({ heading, text });
    buffer = [];
  };
  const blockRegex = /<(h[1-6]|p|li|tr)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(html)) !== null) {
    const tag = (match[1] ?? "").toLowerCase();
    const inner = decodeHtml((match[2] ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (!inner) continue;
    if (tag.startsWith("h")) {
      flush();
      heading = inner;
    } else if (tag === "tr") {
      buffer.push(inner);
    } else {
      buffer.push(inner);
    }
  }
  flush();
  if (sections.length === 0) {
    const plain = normalizeText(decodeHtml(html.replace(/<[^>]+>/g, "\n")));
    if (plain) sections.push({ heading: null, text: plain });
  }
  return sections;
}

async function extractSheet(bytes: Uint8Array): Promise<ExtractedSection[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, { type: "array" });
  const sections: ExtractedSection[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
    if (rows.length === 0) continue;
    const headers = (rows[0] ?? []).map((cell) => String(cell ?? "").trim());
    const hasHeader = headers.some((header) => header && Number.isNaN(Number(header)));
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const lines: string[] = [];
    dataRows.forEach((row, rowIndex) => {
      const parts: string[] = [];
      row.forEach((cell, colIndex) => {
        const value = String(cell ?? "").trim();
        if (!value) return;
        const label = hasHeader ? headers[colIndex] : "";
        parts.push(label ? `${label}: ${value}` : value);
      });
      if (parts.length > 0) lines.push(`Baris ${rowIndex + 1}: ${parts.join("; ")}.`);
    });
    if (lines.length > 0) sections.push({ heading: `Sheet ${sheetName}`, text: lines.join("\n") });
  }
  return sections;
}

async function extractPptx(bytes: Uint8Array): Promise<ExtractedSection[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 0) - Number(b.match(/\d+/)?.[0] ?? 0));
  const sections: ExtractedSection[] = [];
  for (const [index, name] of slideFiles.entries()) {
    const xml = await zip.file(name)!.async("string");
    const paragraphs: string[] = [];
    for (const para of xml.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) {
      const runs = [...para.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeHtml(m[1] ?? ""));
      const line = runs.join("").trim();
      if (line) paragraphs.push(line);
    }
    const first = paragraphs[0];
    if (!first) continue;
    const rest = paragraphs.slice(1);
    const heading = first.length <= 120 ? `Slide ${index + 1}: ${first}` : `Slide ${index + 1}`;
    const text = normalizeText((first.length <= 120 ? rest : paragraphs).join("\n"));
    sections.push({ heading, text: text || first });
  }
  return sections;
}

// Memecah teks mentah menjadi bagian berdasarkan baris yang tampak seperti judul.
function splitByHeadings(text: string, fallbackHeading: string): ExtractedSection[] {
  const lines = text.split("\n");
  const sections: ExtractedSection[] = [];
  let heading: string | null = fallbackHeading;
  let buffer: string[] = [];
  const flush = () => {
    const body = normalizeText(buffer.join("\n"));
    if (body) sections.push({ heading, text: body });
    buffer = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (looksLikeHeading(trimmed) && buffer.length > 0) {
      flush();
      heading = trimmed;
    } else if (looksLikeHeading(trimmed) && buffer.length === 0) {
      heading = trimmed;
    } else {
      buffer.push(trimmed);
    }
  }
  flush();
  return sections;
}

function looksLikeHeading(line: string): boolean {
  const words = line.split(/\s+/).length;
  if (words > 12 || line.length > 90) return false;
  if (/[.:;,]$/.test(line) && !/^\d+(\.\d+)*[.)]?\s/.test(line)) return false;
  if (/^(BAB|BAGIAN|PASAL|LAMPIRAN)\b/i.test(line)) return true;
  if (/^(\d+|[IVXLC]+|[A-Z])[.)]\s+\S/.test(line)) return true;
  const letters = line.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

export function buildChunks(sections: ExtractedSection[], fileName: string): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const baseName = fileName.replace(/\.[^.]+$/, "");

  // Gabungkan bagian yang terlalu pendek dengan bagian berikutnya.
  const merged: ExtractedSection[] = [];
  for (const section of sections) {
    const last = merged[merged.length - 1];
    if (last && wordCount(last.text) < MIN_WORDS && wordCount(last.text) + wordCount(section.text) <= MAX_WORDS) {
      last.text = `${last.text}\n${section.heading ? `${section.heading}\n` : ""}${section.text}`;
      if (!last.heading) last.heading = section.heading;
    } else {
      merged.push({ ...section });
    }
  }

  for (const section of merged) {
    const parts = splitToWordLimit(section.text, MAX_WORDS);
    parts.forEach((part, index) => {
      const suffix = parts.length > 1 ? ` (${index + 1}/${parts.length})` : "";
      const title = section.heading
        ? `${section.heading}${suffix}`.slice(0, 160)
        : `Bagian ${chunks.length + 1} dari ${baseName}`;
      chunks.push({ title, answer: part, keywords: topKeywords(`${section.heading ?? ""} ${part}`) });
    });
  }
  return chunks;
}

function splitToWordLimit(text: string, limit: number): string[] {
  if (wordCount(text) <= limit) return [text];
  const paragraphs = text.split(/\n+/);
  const parts: string[] = [];
  let current: string[] = [];
  let currentWords = 0;
  const push = () => {
    if (current.length) parts.push(current.join("\n"));
    current = [];
    currentWords = 0;
  };
  for (const paragraph of paragraphs) {
    const words = wordCount(paragraph);
    if (words > limit) {
      push();
      const tokens = paragraph.split(/\s+/);
      for (let i = 0; i < tokens.length; i += limit) parts.push(tokens.slice(i, i + limit).join(" "));
      continue;
    }
    if (currentWords + words > limit) push();
    current.push(paragraph);
    currentWords += words;
  }
  push();
  return parts;
}

const STOPWORDS = new Set(
  "yang dan di ke dari untuk dengan pada adalah ini itu atau tidak akan dapat oleh sebagai juga dalam telah bisa ada serta agar jika maka atas bagi para kami kita anda saya nya kepada harus sudah belum masih lebih secara bahwa setiap karena sesuai antara melalui tentang the and of to in for is on with by".split(" "),
);

function topKeywords(text: string, limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z\u00C0-\u024F]{4,}/g) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
