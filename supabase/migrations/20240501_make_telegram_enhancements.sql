
-- Add new event types to the make_event_type enum
ALTER TYPE make_event_type ADD VALUE IF NOT EXISTS 'message_edited';
ALTER TYPE make_event_type ADD VALUE IF NOT EXISTS 'message_deleted';
ALTER TYPE make_event_type ADD VALUE IF NOT EXISTS 'media_group_received';
ALTER TYPE make_event_type ADD VALUE IF NOT EXISTS 'message_forwarded';
ALTER TYPE make_event_type ADD VALUE IF NOT EXISTS 'caption_updated';
ALTER TYPE make_event_type ADD VALUE IF NOT EXISTS 'processing_completed';

-- Add new columns to the make_webhook_configs table
ALTER TABLE make_webhook_configs 
  ADD COLUMN IF NOT EXISTS headers JSONB,
  ADD COLUMN IF NOT EXISTS retry_config JSONB;

-- Add new columns to the make_event_logs table
ALTER TABLE make_event_logs
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_id UUID;

-- Create a table for Telegram event logs
CREATE TABLE IF NOT EXISTS make_telegram_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  webhook_results JSONB,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create indexes for the new table
CREATE INDEX IF NOT EXISTS idx_make_telegram_events_message_id ON make_telegram_events(message_id);
CREATE INDEX IF NOT EXISTS idx_make_telegram_events_event_type ON make_telegram_events(event_type);
CREATE INDEX IF NOT EXISTS idx_make_telegram_events_created_at ON make_telegram_events(created_at);

-- Add index for webhook retry
CREATE INDEX IF NOT EXISTS idx_make_event_logs_retry ON make_event_logs(status, next_retry_at) 
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

-- Create function to process Telegram message events
CREATE OR REPLACE FUNCTION make_process_telegram_message_event(
  message_id UUID,
  event_type TEXT,
  context JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Call the edge function to process the event
  SELECT content::JSONB INTO result
  FROM http((
    'POST',
    CASE 
      WHEN substring(current_setting('request.headers')::json->>'origin', 1, 8) = 'https://' THEN
        substring(current_setting('request.headers')::json->>'origin', 1, length(current_setting('request.headers')::json->>'origin')) 
      ELSE 
        (SELECT COALESCE(value, 'http://localhost:54321') FROM pg_settings WHERE name = 'supabase_url')
    END || '/functions/v1/xdelo_make-telegram-events',
    ARRAY[
      ('Content-Type', 'application/json'),
      ('Authorization', 'Bearer ' || (SELECT value FROM pg_settings WHERE name = 'supabase.anon_key'))
    ],
    'application/json',
    jsonb_build_object(
      'messageId', message_id,
      'eventType', event_type,
      'context', COALESCE(context, '{}'::JSONB)
    )::text
  ));
  
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to test webhook field mapping with a message
CREATE OR REPLACE FUNCTION make_test_webhook_field_mapping(
  webhook_id UUID,
  message_id UUID,
  event_type TEXT
) RETURNS JSONB AS $$
DECLARE
  webhook_config JSONB;
  message_data JSONB;
  result JSONB;
BEGIN
  -- Get webhook configuration
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'field_selection', field_selection,
    'payload_template', payload_template,
    'transformation_code', transformation_code
  ) INTO webhook_config
  FROM make_webhook_configs
  WHERE id = webhook_id;
  
  IF webhook_config IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Webhook not found'
    );
  END IF;
  
  -- Get message data
  SELECT to_jsonb(m) INTO message_data
  FROM messages m
  WHERE id = message_id;
  
  IF message_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Message not found'
    );
  END IF;
  
  -- Call the webhook sender with test flag
  SELECT content::JSONB INTO result
  FROM http((
    'POST',
    CASE 
      WHEN substring(current_setting('request.headers')::json->>'origin', 1, 8) = 'https://' THEN
        substring(current_setting('request.headers')::json->>'origin', 1, length(current_setting('request.headers')::json->>'origin')) 
      ELSE 
        (SELECT COALESCE(value, 'http://localhost:54321') FROM pg_settings WHERE name = 'supabase_url')
    END || '/functions/v1/xdelo_make-telegram-events',
    ARRAY[
      ('Content-Type', 'application/json'),
      ('Authorization', 'Bearer ' || (SELECT value FROM pg_settings WHERE name = 'supabase.anon_key'))
    ],
    'application/json',
    jsonb_build_object(
      'webhookId', webhook_id,
      'eventType', event_type,
      'messageId', message_id,
      'context', jsonb_build_object(
        'is_test', true
      )
    )::text
  ));
  
  RETURN jsonb_build_object(
    'webhook', webhook_config,
    'message', message_data,
    'result', result,
    'success', true
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for the new table
ALTER TABLE make_telegram_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view telegram events"
  ON make_telegram_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Update the existing function to clean event logs to include retry information
CREATE OR REPLACE FUNCTION make_clean_event_logs(older_than TIMESTAMPTZ, webhook_id UUID DEFAULT NULL, status TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM make_event_logs
  WHERE 
    (webhook_id IS NULL OR make_event_logs.webhook_id = webhook_id) AND
    (status IS NULL OR make_event_logs.status::TEXT = status) AND
    created_at < older_than AND
    (next_retry_at IS NULL OR next_retry_at < older_than)
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
