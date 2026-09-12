ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS bot_engine text NOT NULL DEFAULT 'keyword';

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_bot_engine_check;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_bot_engine_check
  CHECK (bot_engine IN ('keyword', 'ai_external'));