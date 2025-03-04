
-- Function to directly trigger caption analysis
CREATE OR REPLACE FUNCTION xdelo_trigger_caption_analysis()
RETURNS TRIGGER AS $$
DECLARE
  v_correlation_id TEXT;
  http_response JSONB;
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

  -- Try to trigger the Edge Function directly if pg_net extension is available
  BEGIN
    -- Call the direct-caption-processor Edge Function using pg_net
    SELECT content::jsonb INTO http_response
    FROM net.http_post(
      url := current_setting('app.settings.supabase_functions_url') || '/functions/v1/direct-caption-processor',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'messageId', NEW.id,
        'correlationId', v_correlation_id,
        'trigger_source', 'database_trigger'
      )
    );
    
    -- Log success if Edge Function was called
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      event_timestamp
    ) VALUES (
      'edge_function_triggered',
      NEW.id,
      v_correlation_id,
      jsonb_build_object(
        'function', 'direct-caption-processor',
        'response', http_response
      ),
      NOW()
    );
  EXCEPTION 
    WHEN OTHERS THEN
      -- Fall back to database function if Edge Function call fails
      PERFORM xdelo_analyze_message_caption(
        NEW.id,
        v_correlation_id::uuid,
        NEW.caption,
        NEW.media_group_id
      );
      
      -- Log fallback
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
      ) VALUES (
        'edge_function_fallback',
        NEW.id,
        v_correlation_id,
        jsonb_build_object(
          'error', SQLERRM,
          'fallback', 'xdelo_analyze_message_caption'
        ),
        NOW()
      );
  END;

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
      
      -- Attempt to call the Edge Function directly
      BEGIN
        PERFORM net.http_post(
          url := current_setting('app.settings.supabase_functions_url') || '/functions/v1/direct-caption-processor',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'messageId', v_message.id,
            'correlationId', v_message.correlation_id,
            'trigger_source', 'scheduled_processor'
          )
        );
        
        -- If we get here, the Edge Function was called successfully
        message_id := v_message.id;
        caption := v_message.caption;
        media_group_id := v_message.media_group_id;
        processed := true;
      EXCEPTION 
        WHEN OTHERS THEN
          -- If no sync was possible and Edge Function failed, prepare for direct analysis with DB function
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
      END;
      
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
