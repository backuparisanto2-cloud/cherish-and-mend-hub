import { supabase } from "@/integrations/supabase/client";
import { KB_CATEGORIES, type KbCategory } from "@/lib/dummy-knowledge";

export { KB_CATEGORIES };
export type { KbCategory };

export type KnowledgeRow = {
  id: string;
  category: KbCategory;
  title: string;
  answer: string;
  keywords: string[];
  is_active: boolean;
};

const SELECT = "id, category, title, answer, keywords, is_active";

export async function fetchKnowledge(): Promise<KnowledgeRow[]> {
  const { data, error } = await supabase
    .from("knowledge_base")
    .select(SELECT)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KnowledgeRow[];
}

export type KnowledgeInput = {
  category: KbCategory;
  title: string;
  answer: string;
  keywords: string[];
};

export async function createKnowledge(input: KnowledgeInput) {
  const { error } = await supabase.from("knowledge_base").insert(input);
  if (error) throw error;
}

export async function updateKnowledge(id: string, input: Partial<KnowledgeInput> & { is_active?: boolean }) {
  const { error } = await supabase.from("knowledge_base").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteKnowledge(id: string) {
  const { error } = await supabase.from("knowledge_base").delete().eq("id", id);
  if (error) throw error;
}
