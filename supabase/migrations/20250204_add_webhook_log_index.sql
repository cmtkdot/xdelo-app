-- Add index for webhook_logs cleanup
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at
    ON webhook_logs (created_at);

-- Add index for webhook_logs message lookup
CREATE INDEX IF NOT EXISTS idx_webhook_logs_message_id
    ON webhook_logs (message_id);
