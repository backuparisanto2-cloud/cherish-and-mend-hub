import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { strToU8, zipSync } from "fflate";

const EXPORT_TABLES = [
  "contacts",
  "conversations",
  "messages",
  "chatera_messages",
  "knowledge_base",
  "knowledge_documents",
  "users",
] as const;

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const lines = [headers.map(toCsvValue).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => toCsvValue(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

/** Ekspor seluruh tabel yang bisa dibaca pengguna menjadi satu ZIP berisi CSV. */
export const exportAllData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const files: Record<string, Uint8Array> = {};
    const summary: { table: string; rows: number }[] = [];

    for (const table of EXPORT_TABLES) {
      const { data, error } = await context.supabase
        .from(table)
        .select("*")
        .limit(50000);
      if (error) {
        files[`${table}.error.txt`] = strToU8(error.message);
        summary.push({ table, rows: 0 });
        continue;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      files[`${table}.csv`] = strToU8(rowsToCsv(rows));
      summary.push({ table, rows: rows.length });
    }

    files["README.txt"] = strToU8(
      [
        "Export data Purworejo chatbot Apps",
        `Dibuat: ${new Date().toISOString()}`,
        "",
        ...summary.map((s) => `${s.table}: ${s.rows} baris`),
      ].join("\n"),
    );

    const zipped = zipSync(files, { level: 6 });
    let binary = "";
    for (const byte of zipped) binary += String.fromCharCode(byte);

    return {
      fileName: `purworejo-chatbot-export-${new Date().toISOString().slice(0, 10)}.zip`,
      base64: btoa(binary),
      summary,
    };
  });
