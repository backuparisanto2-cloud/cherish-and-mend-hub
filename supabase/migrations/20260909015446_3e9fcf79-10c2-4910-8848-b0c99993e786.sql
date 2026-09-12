CREATE TYPE public.conversation_status AS ENUM ('bot_active','waiting_agent','agent_active','closed');
CREATE TYPE public.message_sender_type AS ENUM ('user','bot','agent');

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatera_contact_id text UNIQUE,
  wa_number text,
  name text,
  email text,
  channel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contacts_wa_number_key ON public.contacts (wa_number) WHERE wa_number IS NOT NULL;
GRANT SELECT ON public.contacts TO anon, authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read contacts" ON public.contacts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatera_conversation_id text UNIQUE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'bot_active',
  assigned_agent_chatera_id text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_last_message_at_idx ON public.conversations (last_message_at DESC);
GRANT SELECT ON public.conversations TO anon, authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read conversations" ON public.conversations FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatera_message_id text UNIQUE,
  whatsapp_message_id text,
  direction text NOT NULL DEFAULT 'inbound',
  sender_type public.message_sender_type NOT NULL DEFAULT 'user',
  content_type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);
GRANT SELECT ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read messages" ON public.messages FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;