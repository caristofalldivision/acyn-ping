
CREATE TABLE public.device_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Topha Agent',
  pairing_code TEXT,
  pairing_code_expires_at TIMESTAMPTZ,
  agent_secret_hash TEXT,
  last_seen_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.device_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own agents" ON public.device_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own agents" ON public.device_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own agents" ON public.device_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own agents" ON public.device_agents FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_device_agents_updated BEFORE UPDATE ON public.device_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  agent_id UUID REFERENCES public.device_agents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL DEFAULT 'mikrotik',
  model TEXT,
  routeros_version TEXT,
  host TEXT,
  port INTEGER,
  connection_method TEXT NOT NULL DEFAULT 'rest',
  username TEXT,
  credential_encrypted TEXT,
  last_connected_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own devices" ON public.devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own devices" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own devices" ON public.devices FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.device_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  script_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  output_log TEXT,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.device_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own jobs" ON public.device_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own jobs" ON public.device_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own jobs" ON public.device_jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own jobs" ON public.device_jobs FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_device_jobs_updated BEFORE UPDATE ON public.device_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_device_jobs_device ON public.device_jobs(device_id, created_at DESC);
