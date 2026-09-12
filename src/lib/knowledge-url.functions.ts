import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UrlIngestResult =
  | { ok: true; documentId: string; entriesCreated: number }
  | { ok: false; documentId: string | null; error: string };

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const TIMEOUT_MS = 15_000;

/** Ambil isi halaman web lalu ubah menjadi entri knowledge base (nonaktif) memakai pipeline dokumen. */
export const ingestKnowledgeUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; category: string }) => {
    const raw = String(input?.url ?? "").trim();
    const category = String(input?.category ?? "Umum").trim() || "Umum";
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error("URL tidak valid. Contoh: https://purworejokab.go.id/...");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("URL harus dimulai dengan http:// atau https://");
    }
    return { url: parsed.toString(), category };
  })
  .handler(async ({ data, context }): Promise<UrlIngestResult> => {
    const db = context.supabase;
    const { extractWebPageSections, buildChunks } = await import("@/lib/knowledge-extract.server");

    const hostname = new URL(data.url).hostname;
    const inserted = await db
      .from("knowledge_documents")
      .insert({
        file_name: data.url.length > 180 ? `${data.url.slice(0, 177)}...` : data.url,
        file_type: "url",
        storage_path: data.url,
        category: data.category,
        status: "processing",
      })
      .select("id")
      .single();
    if (inserted.error) return { ok: false, documentId: null, error: inserted.error.message };
    const documentId = inserted.data.id as string;

    const fail = async (message: string): Promise<UrlIngestResult> => {
      await db
        .from("knowledge_documents")
        .update({ status: "failed", error_message: message.slice(0, 1000) })
        .eq("id", documentId);
      return { ok: false, documentId, error: message };
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(data.url, {
          signal: controller.signal,
          redirect: "follow",
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; PurworejoChatbot/1.0)",
            accept: "text/html,application/xhtml+xml",
          },
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return fail(
          aborted
            ? "Halaman tidak merespons dalam 15 detik (timeout)."
            : `Tidak dapat mengakses halaman: ${error instanceof Error ? error.message : "kesalahan jaringan"}`,
        );
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        return fail(
          response.status === 401 || response.status === 403
            ? `Halaman menolak akses (${response.status}); kemungkinan butuh login.`
            : `Halaman tidak dapat diambil (HTTP ${response.status}).`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
        return fail(`Isi halaman bukan HTML (${contentType.split(";")[0]}). Gunakan fitur unggah dokumen.`);
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        return fail("Ukuran halaman melebihi 2 MB, tidak diproses.");
      }
      const html = new TextDecoder("utf-8").decode(buffer);

      const { title, sections } = extractWebPageSections(html);
      const chunks = buildChunks(sections, title || hostname);
      if (chunks.length === 0) {
        return fail("Tidak ada teks yang dapat dibaca dari halaman ini.");
      }

      await db.from("knowledge_base").delete().eq("source_document_id", documentId);
      const rows = chunks.map((chunk) => ({
        category: data.category,
        title: chunk.title,
        answer: chunk.answer,
        keywords: chunk.keywords,
        is_active: false,
        source_document_id: documentId,
      }));
      const insertRows = await db.from("knowledge_base").insert(rows);
      if (insertRows.error) return fail(insertRows.error.message);

      await db
        .from("knowledge_documents")
        .update({
          status: "done",
          entries_created: rows.length,
          error_message: null,
          file_name: title ? `${title} (${hostname})`.slice(0, 180) : data.url.slice(0, 180),
        })
        .eq("id", documentId);

      return { ok: true, documentId, entriesCreated: rows.length };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Gagal memproses halaman");
    }
  });
