
ALTER TABLE public.app_settings
  ADD COLUMN pesapal_consumer_key text,
  ADD COLUMN pesapal_consumer_secret text,
  ADD COLUMN pesapal_ipn_id text,
  ADD COLUMN talksasa_api_key text,
  ADD COLUMN talksasa_sender_id text,
  ADD COLUMN business_name text;
