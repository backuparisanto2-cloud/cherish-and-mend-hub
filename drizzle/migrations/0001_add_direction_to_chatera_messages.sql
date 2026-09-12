ALTER TABLE public.chatera_messages
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound';

CREATE INDEX IF NOT EXISTS chatera_messages_sender_phone_idx
  ON public.chatera_messages (sender_phone, received_at);