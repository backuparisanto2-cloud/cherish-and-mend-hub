CREATE TYPE public.knowledge_document_status AS ENUM ('processing', 'done', 'failed');

CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  category text NOT NULL DEFAULT 'Umum',
  status public.knowledge_document_status NOT NULL DEFAULT 'processing',
  error_message text,
  entries_created integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO anon, authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read knowledge documents" ON public.knowledge_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert knowledge documents" ON public.knowledge_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update knowledge documents" ON public.knowledge_documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete knowledge documents" ON public.knowledge_documents FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE public.knowledge_base
  ADD COLUMN source_document_id uuid REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;
CREATE INDEX idx_knowledge_base_source_document ON public.knowledge_base(source_document_id);

CREATE POLICY "Public upload knowledge documents files" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'knowledge-documents');
CREATE POLICY "Public delete knowledge documents files" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'knowledge-documents');