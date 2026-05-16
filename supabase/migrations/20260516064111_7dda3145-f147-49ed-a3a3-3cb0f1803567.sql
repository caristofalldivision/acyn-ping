
-- plans
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  price_kes integer NOT NULL,
  duration_minutes integer NOT NULL,
  bandwidth_profile text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable by anyone" ON public.plans FOR SELECT USING (true);
CREATE POLICY "owner manages plans ins" ON public.plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner manages plans upd" ON public.plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner manages plans del" ON public.plans FOR DELETE USING (auth.uid() = user_id);

-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  customer_phone text NOT NULL,
  customer_email text,
  hotspot_username text,
  hotspot_password text,
  status text NOT NULL DEFAULT 'pending', -- pending|active|expired|failed|cancelled
  pesapal_tracking_id text,
  pesapal_merchant_ref text,
  amount_kes integer NOT NULL,
  started_at timestamptz,
  expires_at timestamptz,
  warned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subs_status_expires ON public.subscriptions(status, expires_at);
CREATE INDEX subs_tracking ON public.subscriptions(pesapal_tracking_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads subs" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner ins subs" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner upd subs" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner del subs" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);

-- payment_events
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'pesapal',
  event_type text,
  raw_payload jsonb,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads events" ON public.payment_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid())
);

-- app_settings per user
CREATE TABLE public.app_settings (
  user_id uuid PRIMARY KEY,
  sms_sender_id text DEFAULT 'TOPHA',
  sms_on_payment boolean DEFAULT true,
  sms_on_expiry_warn boolean DEFAULT true,
  sms_on_expiry boolean DEFAULT true,
  pesapal_env text DEFAULT 'sandbox', -- sandbox|live
  pesapal_callback_url text,
  default_currency text DEFAULT 'KES',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads settings" ON public.app_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner ins settings" ON public.app_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner upd settings" ON public.app_settings FOR UPDATE USING (auth.uid() = user_id);

-- triggers
CREATE TRIGGER plans_updated BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER settings_updated BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
