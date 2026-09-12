CREATE TYPE public.app_role AS ENUM ('owner', 'admin');

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can read own account"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owners can read all accounts"
  ON public.users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

ALTER TABLE public.messages
  ADD COLUMN agent_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN agent_name text;

DROP POLICY IF EXISTS "Public read inbound messages" ON public.chatera_messages;
CREATE POLICY "Authenticated read inbound messages" ON public.chatera_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read contacts" ON public.contacts;
CREATE POLICY "Authenticated read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read conversations" ON public.conversations;
CREATE POLICY "Authenticated read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read messages" ON public.messages;
CREATE POLICY "Authenticated read messages" ON public.messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Public insert knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Public update knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Public delete knowledge base" ON public.knowledge_base;
CREATE POLICY "Authenticated manage knowledge base" ON public.knowledge_base
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Public insert knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Public update knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Public delete knowledge documents" ON public.knowledge_documents;
CREATE POLICY "Authenticated manage knowledge documents" ON public.knowledge_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.chatera_messages FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.contacts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.conversations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.messages FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

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

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS agent_name text;

GRANT UPDATE ON public.conversations TO authenticated;

CREATE POLICY "Authenticated update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS matched_knowledge_category text;
CREATE INDEX IF NOT EXISTS messages_matched_knowledge_category_idx ON public.messages (matched_knowledge_category) WHERE matched_knowledge_category IS NOT NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS current_menu_path text,
  ADD COLUMN IF NOT EXISTS survey_sent_at timestamp with time zone;