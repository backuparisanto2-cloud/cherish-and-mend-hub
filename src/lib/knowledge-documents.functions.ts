import { createServerFn } from "@tanstack/react-start";

export type ProcessResult = { ok: true; entriesCreated: number } | { ok: false; error: string };

/**
 * Memproses dokumen yang sudah diunggah: ambil file dari storage, ekstrak teks,
 * pecah menjadi bagian, lalu simpan tiap bagian sebagai entri knowledge_base (nonaktif).
 */
export const processKnowledgeDocument = createServerFn({ method: "POST" })
  .inputValidator((input: { documentId: string }) => {
    const documentId = String(input?.documentId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(documentId)) throw new Error("ID dokumen tidak valid");
    return { documentId };
  })
  .handler(async ({ data }): Promise<ProcessResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractSections, buildChunks, detectFileType } = await import("@/lib/knowledge-extract.server");

    const { data: doc, error: docError } = await supabaseAdmin
      .from("knowledge_documents")
      .select("id, file_name, file_type, storage_path, category, status")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docError) return { ok: false, error: docError.message };
    if (!doc) return { ok: false, error: "Dokumen tidak ditemukan" };

    const fail = async (message: string): Promise<ProcessResult> => {
      await supabaseAdmin
        .from("knowledge_documents")
        .update({ status: "failed", error_message: message.slice(0, 1000) })
        .eq("id", doc.id);
      return { ok: false, error: message };
    };

    try {
      const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from("knowledge-documents")
        .download(doc.storage_path);
      if (downloadError || !blob) throw new Error(downloadError?.message ?? "Gagal mengunduh file dari storage");

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const fileType = doc.file_type || detectFileType(doc.file_name);
      const sections = await extractSections(bytes, fileType);
      const chunks = buildChunks(sections, doc.file_name);
      if (chunks.length === 0) throw new Error("Tidak ada teks yang dapat dibaca dari dokumen ini.");

      // Hapus entri lama bila dokumen diproses ulang.
      await supabaseAdmin.from("knowledge_base").delete().eq("source_document_id", doc.id);

      const rows = chunks.map((chunk) => ({
        category: doc.category,
        title: chunk.title,
        answer: chunk.answer,
        keywords: chunk.keywords,
        is_active: false,
        source_document_id: doc.id,
      }));
      const { error: insertError } = await supabaseAdmin.from("knowledge_base").insert(rows);
      if (insertError) throw new Error(insertError.message);

      await supabaseAdmin
        .from("knowledge_documents")
        .update({ status: "done", entries_created: rows.length, error_message: null })
        .eq("id", doc.id);
      return { ok: true, entriesCreated: rows.length };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Gagal memproses dokumen");
    }
  });
