CREATE POLICY "Authenticated read app assets" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'app-assets');

CREATE POLICY "Owners upload app assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners update app assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners delete app assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));