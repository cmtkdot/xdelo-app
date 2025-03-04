
-- Function to directly trigger caption analysis
CREATE OR REPLACE FUNCTION xdelo_trigger_caption_analysis()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id TEXT;
BEGIN
  -- Skip if no caption or already analyzed
  IF NEW.caption IS NULL OR NEW.caption = '' OR NEW.analyzed_content IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Generate a correlation ID if not present
  v_correlation_id := COALESCE(NEW.correlation_id, gen_random_uuid()::text);

  -- Update status to processing
  UPDATE messages
  SET 
    processing_state = 'pending',
    processing_correlation_id = v_correlation_id::uuid,
    updated_at = NOW()
  WHERE id = NEW.id;

  -- Log the direct trigger request
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'direct_caption_analysis_triggered',
    NEW.id,
    v_correlation_id,
    jsonb_build_object(
      'caption_length', length(NEW.caption),
      'media_group_id', NEW.media_group_id,
      'trigger_type', TG_OP
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to analyze captions on insert or update
DROP TRIGGER IF EXISTS trigger_direct_caption_analysis ON messages;
CREATE TRIGGER trigger_direct_caption_analysis
  AFTER INSERT OR UPDATE OF caption
  ON messages
  FOR EACH ROW
  WHEN (NEW.caption IS NOT NULL AND NEW.caption != '' AND NEW.analyzed_content IS NULL)
  EXECUTE FUNCTION xdelo_trigger_caption_analysis();

-- Function to process pending messages
CREATE OR REPLACE FUNCTION xdelo_process_pending_messages(limit_count integer DEFAULT 10)
RETURNS TABLE(
  message_id uuid,
  caption text,
  media_group_id text,
  processed boolean
) AS $$
DECLARE
  v_message record;
  v_processed boolean;
BEGIN
  FOR v_message IN
    SELECT 
      id, 
      caption, 
      media_group_id, 
      correlation_id::text
    FROM messages
    WHERE 
      processing_state = 'pending'
      AND caption IS NOT NULL 
      AND caption != ''
      AND analyzed_content IS NULL
    ORDER BY updated_at ASC
    LIMIT limit_count
  LOOP
    BEGIN
      -- First try to sync from media group if applicable
      IF v_message.media_group_id IS NOT NULL THEN
        PERFORM xdelo_check_media_group_content(
          v_message.media_group_id,
          v_message.id,
          v_message.correlation_id
        );
        
        -- Check if sync was successful
        SELECT analyzed_content IS NOT NULL INTO v_processed
        FROM messages
        WHERE id = v_message.id;
        
        IF v_processed THEN
          message_id := v_message.id;
          caption := v_message.caption;
          media_group_id := v_message.media_group_id;
          processed := true;
          RETURN NEXT;
          CONTINUE;
        END IF;
      END IF;
      
      -- If no sync was possible, prepare for direct analysis
      PERFORM xdelo_analyze_message_caption(
        v_message.id,
        v_message.correlation_id::uuid,
        v_message.caption,
        v_message.media_group_id
      );
      
      message_id := v_message.id;
      caption := v_message.caption;
      media_group_id := v_message.media_group_id;
      processed := true;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        event_timestamp
      ) VALUES (
        'direct_processing_error',
        v_message.id,
        v_message.correlation_id,
        SQLERRM,
        NOW()
      );
      
      message_id := v_message.id;
      caption := v_message.caption;
      media_group_id := v_message.media_group_id;
      processed := false;
    END;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;
