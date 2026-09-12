CREATE POLICY "Authenticated read knowledge documents files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated update knowledge documents files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'knowledge-documents') WITH CHECK (bucket_id = 'knowledge-documents');