ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS awaiting_operator_confirmation boolean NOT NULL DEFAULT false;