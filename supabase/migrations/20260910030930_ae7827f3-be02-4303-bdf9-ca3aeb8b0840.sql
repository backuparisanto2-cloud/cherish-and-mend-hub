ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS current_menu_path text,
  ADD COLUMN IF NOT EXISTS survey_sent_at timestamp with time zone;