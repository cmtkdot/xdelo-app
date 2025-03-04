
-- Enable the required extensions if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove old cron job
select cron.unschedule('process-message-queue');

-- Schedule the function to run every 15 minutes
select cron.schedule(
  'process-captions',
  '*/15 * * * *',
  $$
  select xdelo_schedule_caption_processing();
  $$
);
