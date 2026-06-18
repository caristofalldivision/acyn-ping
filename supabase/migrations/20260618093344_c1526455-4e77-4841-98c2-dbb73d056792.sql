ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ai_provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS gemini_api_key text,
  ADD COLUMN IF NOT EXISTS gemini_model text NOT NULL DEFAULT 'gemini-2.5-pro';