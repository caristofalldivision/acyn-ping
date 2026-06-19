ALTER TABLE public.saved_scripts ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.saved_scripts ADD COLUMN IF NOT EXISTS placeholders jsonb;

DROP TRIGGER IF EXISTS update_saved_scripts_updated_at ON public.saved_scripts;
CREATE TRIGGER update_saved_scripts_updated_at
BEFORE UPDATE ON public.saved_scripts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();