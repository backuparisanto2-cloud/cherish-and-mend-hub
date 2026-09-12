import { supabase } from "@/integrations/supabase/client";
import type { KbCategory } from "@/lib/dummy-knowledge";

export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"] as const;

export type KnowledgeDocumentStatus = "processing" | "done" | "failed";

export type KnowledgeDocument = {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  category: KbCategory;
  status: KnowledgeDocumentStatus;
  error_message: string | null;
  entries_created: number;
  created_at: string;
};

const SELECT = "id, file_name, file_type, storage_path, category, status, error_message, entries_created, created_at";

export async function fetchKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as KnowledgeDocument[];
}

export function getExtension(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

/** Unggah file ke storage lalu buat baris dokumen berstatus "processing". Mengembalikan id dokumen. */
export async function uploadKnowledgeDocument(file: File, category: KbCategory): Promise<string> {
  const ext = getExtension(file.name);
  if (!(DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new Error("Tipe file tidak didukung. Gunakan PDF, Word, Excel, atau PowerPoint.");
  }
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("knowledge-documents")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({ file_name: file.name, file_type: ext, storage_path: storagePath, category })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("knowledge-documents").remove([storagePath]);
    throw error;
  }
  return data.id;
}

/** Hapus dokumen, file di storage, dan entri knowledge_base turunannya (via cascade). */
export async function deleteKnowledgeDocument(doc: Pick<KnowledgeDocument, "id" | "storage_path"> & { file_type?: string }) {
  // Sumber URL tidak punya file fisik di storage.
  const isUrl = doc.file_type === "url" || /^https?:\/\//i.test(doc.storage_path);
  if (!isUrl) await supabase.storage.from("knowledge-documents").remove([doc.storage_path]);
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", doc.id);
  if (error) throw error;
}
