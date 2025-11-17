-- Enable required extensions for cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create cron job to run background learning every 6 hours
SELECT cron.schedule(
  'background-learning-every-6-hours',
  '0 */6 * * *', -- At minute 0 past every 6th hour (00:00, 06:00, 12:00, 18:00)
  $$
  SELECT net.http_post(
    url := 'https://felddksssxwpehozsbmt.supabase.co/functions/v1/background-learning',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlbGRka3Nzc3h3cGVob3pzYm10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTY2OTMsImV4cCI6MjA3ODc5MjY5M30.M_h4L4Vkqm7w8gOdTdvlFAu4vEt64JMUBWFckp8voZw"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Function to view background learning job status
CREATE OR REPLACE FUNCTION get_background_learning_status()
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  active boolean
) AS $$
  SELECT jobid, schedule, command, active 
  FROM cron.job 
  WHERE jobname = 'background-learning-every-6-hours';
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to manually trigger background learning (returns request ID)
CREATE OR REPLACE FUNCTION trigger_background_learning()
RETURNS bigint AS $$
  SELECT net.http_post(
    url := 'https://felddksssxwpehozsbmt.supabase.co/functions/v1/background-learning',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlbGRka3Nzc3h3cGVob3pzYm10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTY2OTMsImV4cCI6MjA3ODc5MjY5M30.M_h4L4Vkqm7w8gOdTdvlFAu4vEt64JMUBWFckp8voZw"}'::jsonb,
    body := '{}'::jsonb
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Create table to track which conversations have been scanned
CREATE TABLE IF NOT EXISTS conversation_scan_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_scanned_message_id UUID,
  last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count_at_scan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id)
);

-- Enable RLS
ALTER TABLE conversation_scan_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own scan status"
  ON conversation_scan_status
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage scan status"
  ON conversation_scan_status
  FOR ALL
  USING (true);

-- Index for faster lookups
CREATE INDEX idx_conversation_scan_status_conversation_id 
  ON conversation_scan_status(conversation_id);

CREATE INDEX idx_conversation_scan_status_user_id 
  ON conversation_scan_status(user_id);