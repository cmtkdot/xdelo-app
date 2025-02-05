-- Create message_processing_state type if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_processing_state') THEN
        CREATE TYPE message_processing_state AS ENUM (
            'initialized',
            'pending',
            'processing',
            'completed',
            'error'
        );
    END IF;
END $$;

-- Add new columns for message deletion and webhook tracking
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_quantity numeric,
  ADD COLUMN IF NOT EXISTS product_unit text,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_state message_processing_state;

-- Create IMMUTABLE functions for analyzed content extraction
CREATE OR REPLACE FUNCTION extract_product_name(analyzed_content jsonb)
RETURNS text AS $$
BEGIN
    RETURN analyzed_content->>'product_name';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION extract_product_quantity(analyzed_content jsonb)
RETURNS numeric AS $$
BEGIN
    RETURN (analyzed_content->>'quantity')::numeric;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION extract_product_unit(analyzed_content jsonb)
RETURNS text AS $$
BEGIN
    RETURN analyzed_content->>'unit';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION extract_vendor_name(analyzed_content jsonb)
RETURNS text AS $$
BEGIN
    RETURN analyzed_content->>'vendor';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION extract_confidence_score(analyzed_content jsonb)
RETURNS numeric AS $$
BEGIN
    RETURN (analyzed_content->>'confidence')::numeric;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION extract_analyzed_at(analyzed_content jsonb)
RETURNS timestamptz AS $$
BEGIN
    RETURN (analyzed_content->>'analyzed_at')::timestamptz;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add computed columns using the IMMUTABLE functions
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS product_name text GENERATED ALWAYS AS (extract_product_name(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS product_quantity numeric GENERATED ALWAYS AS (extract_product_quantity(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS product_unit text GENERATED ALWAYS AS (extract_product_unit(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS vendor_name text GENERATED ALWAYS AS (extract_vendor_name(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS confidence_score numeric GENERATED ALWAYS AS (extract_confidence_score(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz GENERATED ALWAYS AS (extract_analyzed_at(analyzed_content)) STORED;

-- Add indexes for the computed columns
CREATE INDEX IF NOT EXISTS idx_messages_product_name 
  ON messages (product_name) 
  WHERE product_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_vendor_name 
  ON messages (vendor_name) 
  WHERE vendor_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_confidence_score 
  ON messages (confidence_score) 
  WHERE confidence_score IS NOT NULL;

-- Add index for deleted messages
CREATE INDEX IF NOT EXISTS idx_messages_deleted 
  ON messages (deleted_at) 
  WHERE is_deleted = true;

-- Add index for telegram message lookup
CREATE INDEX IF NOT EXISTS idx_messages_telegram_lookup 
  ON messages ((telegram_data->>'chat_id'), telegram_message_id);

-- Create analysis_audit_log table
CREATE TABLE IF NOT EXISTS public.analysis_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  media_group_id text,
  event_type text NOT NULL,
  old_state message_processing_state,
  new_state message_processing_state,
  analyzed_content jsonb,
  processing_details jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT analysis_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT analysis_audit_log_message_id_fkey FOREIGN KEY (message_id) 
    REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT analysis_audit_log_event_type_check 
    CHECK (event_type IN (
      'ANALYSIS_STARTED',
      'ANALYSIS_COMPLETED',
      'ANALYSIS_FAILED',
      'GROUP_SYNC_STARTED',
      'GROUP_SYNC_COMPLETED',
      'GROUP_SYNC_FAILED',
      'RETRY_ATTEMPTED'
    ))
);

-- Add indexes for analysis_audit_log
CREATE INDEX IF NOT EXISTS idx_analysis_audit_log_message_id 
  ON analysis_audit_log (message_id);

CREATE INDEX IF NOT EXISTS idx_analysis_audit_log_media_group 
  ON analysis_audit_log (media_group_id) 
  WHERE media_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_audit_log_created_at 
  ON analysis_audit_log (created_at);

-- Create webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NULL,
  event_type text NOT NULL,
  request_payload jsonb NULL,
  response_payload jsonb NULL,
  status_code integer NULL,
  created_at timestamptz NULL DEFAULT now(),
  error_message text NULL,
  trigger_event text NULL,
  processing_state message_processing_state NULL,
  analyzed_content_hash text NULL,
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_logs_message_id_fkey FOREIGN KEY (message_id) 
    REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT webhook_logs_event_type_check 
    CHECK (event_type IN (
      'MESSAGE_CREATED', 
      'MESSAGE_UPDATED', 
      'MESSAGE_DELETED', 
      'CHAT_MEMBER_UPDATED',
      'SYNC_RETRY'
    ))
);

-- Add indexes for webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at 
  ON webhook_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_message_id 
  ON webhook_logs (message_id);

-- Add function to clean old logs
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  -- Clean webhook logs older than 30 days
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean analysis audit logs older than 90 days
  DELETE FROM analysis_audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily
SELECT cron.schedule(
  'cleanup-logs',
  '0 0 * * *',  -- Run at midnight every day
  'SELECT cleanup_old_logs();'
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_old_logs() TO authenticated;
GRANT EXECUTE ON FUNCTION extract_product_name(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_product_quantity(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_product_unit(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_vendor_name(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_confidence_score(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_analyzed_at(jsonb) TO authenticated;

-- Update webhook handling trigger
CREATE OR REPLACE FUNCTION handle_webhook_update()
RETURNS trigger AS $$
BEGIN
  -- Only create webhook log for actual changes
  IF (TG_OP = 'INSERT') OR (
     OLD.caption IS DISTINCT FROM NEW.caption OR
     OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content OR
     OLD.processing_state IS DISTINCT FROM NEW.processing_state OR
     OLD.is_deleted IS DISTINCT FROM NEW.is_deleted
  ) THEN
    INSERT INTO webhook_logs (
      message_id,
      event_type,
      request_payload,
      processing_state,
      analyzed_content_hash,
      trigger_event
    ) VALUES (
      NEW.id,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'MESSAGE_CREATED'
        WHEN NEW.is_deleted THEN 'MESSAGE_DELETED'
        ELSE 'MESSAGE_UPDATED'
      END,
      NEW.telegram_data,
      NEW.processing_state,
      CASE 
        WHEN NEW.analyzed_content IS NOT NULL 
        THEN encode(digest(NEW.analyzed_content::text, 'sha256'), 'hex')
        ELSE NULL
      END,
      TG_OP
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update sync retry trigger to handle message deletion
CREATE OR REPLACE FUNCTION handle_sync_retry()
RETURNS trigger AS $$
BEGIN
  -- Don't retry deleted messages
  IF NEW.is_deleted THEN
    RETURN NEW;
  END IF;

  -- Increment retry count
  UPDATE messages 
  SET 
    retry_count = COALESCE(retry_count, 0) + 1,
    last_error_at = NOW()
  WHERE id = NEW.id;

  -- Notify about retry
  INSERT INTO webhook_logs (
    message_id,
    event_type,
    processing_state,
    trigger_event
  ) VALUES (
    NEW.id,
    'SYNC_RETRY',
    NEW.processing_state,
    'RETRY'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for analyzed content updates
DROP TRIGGER IF EXISTS trg_update_analyzed_content_columns ON messages;
CREATE TRIGGER trg_update_analyzed_content_columns
  BEFORE INSERT OR UPDATE OF analyzed_content
  ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_analyzed_content_columns();

-- Create function to update analyzed content columns
CREATE OR REPLACE FUNCTION update_analyzed_content_columns()
RETURNS trigger AS $$
BEGIN
  -- Only update if analyzed_content has changed and is not null
  IF NEW.analyzed_content IS DISTINCT FROM OLD.analyzed_content AND NEW.analyzed_content IS NOT NULL THEN
    NEW.product_name := extract_product_name(NEW.analyzed_content);
    NEW.product_quantity := extract_product_quantity(NEW.analyzed_content);
    NEW.product_unit := extract_product_unit(NEW.analyzed_content);
    NEW.vendor_name := extract_vendor_name(NEW.analyzed_content);
    NEW.confidence_score := extract_confidence_score(NEW.analyzed_content);
    NEW.analyzed_at := extract_analyzed_at(NEW.analyzed_content);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
