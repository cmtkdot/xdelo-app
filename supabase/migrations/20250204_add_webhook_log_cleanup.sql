-- Create function to clean up old webhook logs
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete webhook logs older than 7 days
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Create a cron job to run cleanup daily
SELECT cron.schedule(
  'cleanup-webhook-logs', -- name of the cron job
  '0 0 * * *',           -- run at midnight every day
  'SELECT cleanup_old_webhook_logs();'
);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_old_webhook_logs() TO authenticated;
