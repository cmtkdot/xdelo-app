
-- First make sure we can detect captions reliably
CREATE OR REPLACE FUNCTION xdelo_has_valid_caption(p_caption TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caption exists and isn't empty
  RETURN p_caption IS NOT NULL AND trim(p_caption) <> '';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to automatically queue messages with captions
CREATE OR REPLACE FUNCTION xdelo_auto_queue_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue messages with captions for processing
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.caption <> NEW.caption)) 
     AND xdelo_has_valid_caption(NEW.caption) THEN
      
    -- Only if not already in processing or completed state
    IF NEW.processing_state IS NULL OR NEW.processing_state IN ('initialized', 'pending', 'error') THEN
      -- Log the trigger activation
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        event_timestamp
      ) VALUES (
        'trigger_auto_queue_activated',
        NEW.id,
        jsonb_build_object(
          'correlation_id', NEW.correlation_id,
          'caption', NEW.caption,
          'processing_state', NEW.processing_state,
          'trigger_operation', TG_OP
        ),
        NOW()
      );
    
      -- Queue for processing using DB function
      PERFORM xdelo_queue_message_for_processing(NEW.id, NEW.correlation_id);
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Apply the trigger to the messages table, removing any existing one first
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;
CREATE TRIGGER xdelo_auto_queue_messages_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_auto_queue_messages();

-- Remove the old trigger that tried to directly call the edge function
DROP TRIGGER IF EXISTS monitor_mssages_table ON messages;
