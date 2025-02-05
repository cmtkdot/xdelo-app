-- First, drop the foreign key constraint if it exists
ALTER TABLE webhook_logs
  DROP CONSTRAINT IF EXISTS webhook_logs_message_id_fkey;

-- Update webhook_logs table structure
ALTER TABLE webhook_logs
  ALTER COLUMN message_id TYPE text, -- Change from uuid to text for telegram_message_id
  ADD COLUMN IF NOT EXISTS chat_id bigint,
  ADD COLUMN IF NOT EXISTS media_group_id text,
  ALTER COLUMN event_type TYPE text,
  ALTER COLUMN processing_state DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS webhook_logs_event_type_check;

-- Add new constraint for event types
ALTER TABLE webhook_logs
  ADD CONSTRAINT webhook_logs_event_type_check 
  CHECK (event_type IN (
    'FETCH_STARTED',
    'FETCH_COMPLETED',
    'FETCH_FAILED',
    'MEDIA_DOWNLOAD_STARTED',
    'MEDIA_DOWNLOAD_COMPLETED',
    'MEDIA_DOWNLOAD_FAILED'
  ));

-- Drop old trigger that was linking to messages
DROP TRIGGER IF EXISTS trg_handle_webhook_update ON messages;
DROP FUNCTION IF EXISTS handle_webhook_update();

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_webhook_logs_message_lookup
  ON webhook_logs (message_id, chat_id)
  WHERE event_type = 'FETCH_COMPLETED';

CREATE INDEX IF NOT EXISTS idx_webhook_logs_media_group
  ON webhook_logs (media_group_id)
  WHERE media_group_id IS NOT NULL;

-- Function to clean old logs (keep for 7 days since it's just fetch logs)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
