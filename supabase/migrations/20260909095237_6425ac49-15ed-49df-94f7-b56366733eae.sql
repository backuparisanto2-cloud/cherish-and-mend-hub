-- Roles
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

-- No INSERT/UPDATE/DELETE policies: account management happens server-side
-- with the service role only, which prevents privilege escalation.

-- Track which signed-in agent sent an outbound message
ALTER TABLE public.messages
  ADD COLUMN agent_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN agent_name text;

-- Lock down previously public data to signed-in users only
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
