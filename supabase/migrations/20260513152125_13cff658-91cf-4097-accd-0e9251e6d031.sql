ALTER PUBLICATION supabase_realtime ADD TABLE public.device_jobs;
ALTER TABLE public.device_jobs REPLICA IDENTITY FULL;