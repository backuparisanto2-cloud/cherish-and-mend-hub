CREATE TABLE public.bot_menus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid REFERENCES public.bot_menus(id) ON DELETE CASCADE,
  key text NOT NULL DEFAULT '',
  path text NOT NULL UNIQUE,
  emoji text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Umum',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX bot_menus_parent_id_idx ON public.bot_menus(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_menus TO authenticated;
GRANT ALL ON public.bot_menus TO service_role;

ALTER TABLE public.bot_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage bot menus"
  ON public.bot_menus FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_bot_menus_updated_at
  BEFORE UPDATE ON public.bot_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();