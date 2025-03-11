
-- Start transaction
BEGIN;

-- Setup scheduled maintenance jobs with cron
DO $$
BEGIN
  -- First try to unschedule existing jobs
  BEGIN
    PERFORM cron.unschedule('process-pending-messages');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  BEGIN
    PERFORM cron.unschedule('xdelo-daily-maintenance');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  BEGIN
    PERFORM cron.unschedule('xdelo-hourly-maintenance');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  -- Create new jobs
  PERFORM cron.schedule(
    'process-pending-messages',
    '*/5 * * * *',  -- Every 5 minutes
    'SELECT xdelo_process_pending_messages(20);'
  );
  
  PERFORM cron.schedule(
    'xdelo-hourly-maintenance',
    '5 * * * *',  -- 5 minutes past every hour
    'SELECT xdelo_reset_stalled_messages();'
  );
  
  PERFORM cron.schedule(
    'xdelo-daily-maintenance',
    '0 3 * * *',  -- 3 AM daily
    'SELECT xdelo_repair_all_processing_systems();'
  );
END
$$;

-- Update the documentation
INSERT INTO gl_documentation (
  name,
  module,
  description,
  created_at
) VALUES (
  'Consolidated Database Functions',
  'Database Functions',
  'This module provides consolidated functions for media group synchronization, message processing, and system maintenance after the cleanup process.',
  NOW()
) ON CONFLICT (name) DO UPDATE
SET 
  description = 'This module provides consolidated functions for media group synchronization, message processing, and system maintenance after the cleanup process.';

-- Commit transaction
COMMIT;
