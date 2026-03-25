CREATE TABLE public.saved_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_id TEXT,
  script_content TEXT NOT NULL,
  form_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.saved_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scripts" ON public.saved_scripts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scripts" ON public.saved_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scripts" ON public.saved_scripts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scripts" ON public.saved_scripts FOR DELETE TO authenticated USING (auth.uid() = user_id);