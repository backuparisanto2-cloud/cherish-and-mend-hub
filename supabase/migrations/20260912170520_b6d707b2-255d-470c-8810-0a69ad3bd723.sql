ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'id';

CREATE TABLE public.bot_menu_translations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_path text NOT NULL,
  language text NOT NULL,
  source_hash text NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (menu_path, language)
);

GRANT SELECT ON public.bot_menu_translations TO authenticated;
GRANT ALL ON public.bot_menu_translations TO service_role;

ALTER TABLE public.bot_menu_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read menu translations" ON public.bot_menu_translations FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_bot_menu_translations_updated_at BEFORE UPDATE ON public.bot_menu_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();