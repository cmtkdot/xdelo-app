-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job to run every 5 minutes
SELECT cron.schedule(
  'process-glide-sync-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://xjhhehxcxkiumnwbirel.supabase.co/functions/v1/process-glide-sync-queue',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);