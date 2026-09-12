CREATE POLICY "Authenticated upload knowledge documents files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated delete knowledge documents files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated read knowledge documents files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated update knowledge documents files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'knowledge-documents') WITH CHECK (bucket_id = 'knowledge-documents');

CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instansi_name text NOT NULL DEFAULT 'Pemerintah Kabupaten Purworejo',
  logo_url text,
  jam_buka text NOT NULL DEFAULT '08:00',
  jam_tutup text NOT NULL DEFAULT '15:30',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners insert app settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners update app settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (instansi_name, jam_buka, jam_tutup) VALUES ('Pemerintah Kabupaten Purworejo', '08:00', '15:30');

CREATE POLICY "Authenticated read app assets" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'app-assets');

CREATE POLICY "Owners upload app assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners update app assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners delete app assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS awaiting_operator_confirmation boolean NOT NULL DEFAULT false;

CREATE TABLE public.conversation_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatera_conversation_id text,
  from_status text,
  to_status text,
  source text NOT NULL DEFAULT 'system',
  actor text,
  assignee_chatera_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.conversation_status_events TO authenticated;
GRANT ALL ON public.conversation_status_events TO service_role;

ALTER TABLE public.conversation_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read status events"
ON public.conversation_status_events
FOR SELECT TO authenticated
USING (true);

CREATE INDEX conversation_status_events_created_at_idx
  ON public.conversation_status_events (created_at DESC);
CREATE INDEX conversation_status_events_conversation_idx
  ON public.conversation_status_events (conversation_id);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS bot_engine text NOT NULL DEFAULT 'keyword';

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_bot_engine_check;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_bot_engine_check
  CHECK (bot_engine IN ('keyword', 'ai_external'));