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