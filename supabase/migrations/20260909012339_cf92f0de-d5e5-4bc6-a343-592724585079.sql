CREATE TABLE public.chatera_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  message_id text,
  conversation_id text,
  channel_id text,
  sender_phone text,
  sender_name text,
  content_text text,
  event_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chatera_messages_received_at_idx ON public.chatera_messages (received_at DESC);

GRANT SELECT ON public.chatera_messages TO anon;
GRANT SELECT ON public.chatera_messages TO authenticated;
GRANT ALL ON public.chatera_messages TO service_role;

ALTER TABLE public.chatera_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read inbound messages"
  ON public.chatera_messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.chatera_messages
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound';

CREATE INDEX IF NOT EXISTS chatera_messages_sender_phone_idx
  ON public.chatera_messages (sender_phone, received_at);