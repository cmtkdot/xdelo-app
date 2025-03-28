
-- Drop the existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_process_caption ON messages;

-- Create a new, improved trigger function
CREATE OR REPLACE FUNCTION trigger_caption_processing() 
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when caption is added or changed AND is not empty
  IF (TG_OP = 'INSERT' AND NEW.caption IS NOT NULL AND LENGTH(TRIM(NEW.caption)) > 0) OR
     (TG_OP = 'UPDATE' AND 
      (OLD.caption IS NULL OR OLD.caption <> NEW.caption) AND 
      NEW.caption IS NOT NULL AND LENGTH(TRIM(NEW.caption)) > 0) THEN
    
    -- Log trigger execution to aid debugging
    INSERT INTO unified_audit_logs (
      event_type, 
      entity_id, 
      metadata
    ) VALUES (
      'trigger_caption_processing_executed', 
      NEW.id, 
      jsonb_build_object(
        'operation', TG_OP,
        'old_caption', OLD.caption,
        'new_caption', NEW.caption,
        'old_processing_state', OLD.processing_state,
        'timestamp', now()
      )
    );
    
    -- For edited messages, preserve history
    IF TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL THEN
      -- Store previous analyzed_content in the history array
      IF NEW.old_analyzed_content IS NULL THEN
        NEW.old_analyzed_content = ARRAY[OLD.analyzed_content];
      ELSE
        NEW.old_analyzed_content = array_append(NEW.old_analyzed_content, OLD.analyzed_content);
      END IF;
      
      NEW.is_edited = TRUE;
      
      -- If this is an edited message, track edit count
      IF NEW.edit_count IS NULL THEN
        NEW.edit_count = 1;
      ELSE
        NEW.edit_count = NEW.edit_count + 1;
      END IF;
    END IF;

    -- Set to pending for processing
    NEW.processing_state = 'pending';
    NEW.processing_started_at = NOW();
    
    -- Reset any previous error state
    NEW.error_message = NULL;
    
    -- Add metadata about this trigger execution
    NEW.telegram_metadata = COALESCE(NEW.telegram_metadata, '{}'::jsonb) || jsonb_build_object(
      'trigger_update_type', TG_OP,
      'trigger_time', NOW(),
      'caption_length', LENGTH(NEW.caption)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new trigger with a condition to ensure caption is not empty
CREATE TRIGGER trigger_process_caption
BEFORE INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND LENGTH(TRIM(NEW.caption)) > 0)
EXECUTE FUNCTION trigger_caption_processing();

-- Reset any messages that are in an inconsistent state (pending but with empty caption)
UPDATE messages 
SET 
  processing_state = 'error',
  error_message = 'Empty caption in pending state - reset by migration',
  updated_at = NOW()
WHERE 
  processing_state = 'pending' 
  AND (caption IS NULL OR LENGTH(TRIM(caption)) = 0);

-- Also create a cron job to periodically reset stalled messages
CREATE OR REPLACE FUNCTION xdelo_reset_stalled_messages(minutes_threshold INTEGER DEFAULT 15)
RETURNS TABLE (message_id UUID, old_state TEXT, new_state TEXT) AS $$
BEGIN
  RETURN QUERY
  UPDATE messages
  SET 
    processing_state = 'error',
    error_message = 'Processing timed out after ' || minutes_threshold || ' minutes',
    updated_at = NOW(),
    last_error_at = NOW()
  WHERE 
    processing_state = 'processing'
    AND processing_started_at < (NOW() - (minutes_threshold * INTERVAL '1 minute'))
    AND (last_processing_attempt IS NULL OR last_processing_attempt < (NOW() - (minutes_threshold * INTERVAL '1 minute')))
  RETURNING 
    id AS message_id, 
    'processing' AS old_state, 
    'error' AS new_state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Setup cron job for stalled messages - runs every 5 minutes
SELECT cron.schedule(
  'reset-stalled-messages-every-5-minutes',
  '*/5 * * * *',  -- Run every 5 minutes
  'SELECT xdelo_reset_stalled_messages(15)'
);
