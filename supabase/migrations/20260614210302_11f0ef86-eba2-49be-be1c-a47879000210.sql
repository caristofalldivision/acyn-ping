GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_agents TO authenticated;
GRANT ALL ON public.device_agents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_jobs TO authenticated;
GRANT ALL ON public.device_jobs TO service_role;