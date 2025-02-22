-- Enable the required extensions if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the function to run every 15 minutes
select cron.schedule(
  'process-unanalyzed-messages',
  '*/15 * * * *',
  $$
  select net.http_post(
    url:='{{SUPABASE_URL}}/functions/v1/process-unanalyzed-messages',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer {{SUPABASE_SERVICE_ROLE_KEY}}"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);