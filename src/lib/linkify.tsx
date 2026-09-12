import type { ReactNode } from "react";

// Ubah URL, email, dan nomor telepon di dalam teks pesan menjadi tautan yang
// bisa diklik pada riwayat chat halaman admin.

const PATTERN =
  /((?:https?:\/\/|www\.)[^\s<>"]+[^\s<>".,;:!?)\]]|[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+62|62|0)[\s.-]?8\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{3,5}(?:[\s.-]?\d{1,4})?)/g;

function telHref(raw: string): string {
  const digits = (raw.match(/\d+/g) ?? []).join("");
  if (digits.startsWith("62")) return `tel:+${digits}`;
  if (digits.startsWith("0")) return `tel:+62${digits.slice(1)}`;
  return `tel:+${digits}`;
}

/** Render teks biasa dengan URL/email/telepon sebagai tautan. */
export function Linkify({ text }: { text: string }): ReactNode {
  const parts = (text ?? "").split(PATTERN);
  return parts.map((part, index) => {
    if (!part) return null;
    const key = `${index}-${part.slice(0, 12)}`;
    const className = "underline decoration-current/40 underline-offset-2 hover:decoration-current";

    if (/^(?:https?:\/\/|www\.)/i.test(part)) {
      const href = part.startsWith("www.") ? `https://${part}` : part;
      return (
        <a key={key} href={href} target="_blank" rel="noreferrer noopener" className={className}>
          {part}
        </a>
      );
    }
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(part)) {
      return (
        <a key={key} href={`mailto:${part}`} className={className}>
          {part}
        </a>
      );
    }
    if (/^(?:\+62|62|0)[\s.-]?8\d/.test(part)) {
      return (
        <a key={key} href={telHref(part)} className={className}>
          {part}
        </a>
      );
    }
    return <span key={key}>{part}</span>;
  });
}
