-- Drop the cron job if it exists
SELECT cron.unschedule('cleanup-webhook-logs');

-- Drop the cleanup function
DROP FUNCTION IF EXISTS cleanup_old_webhook_logs();

-- Drop indexes
DROP INDEX IF EXISTS idx_webhook_logs_created_at;
DROP INDEX IF EXISTS idx_webhook_logs_message_id;

-- Drop the webhook_logs table
DROP TABLE IF EXISTS webhook_logs;
