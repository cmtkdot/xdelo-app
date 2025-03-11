
-- Start transaction
BEGIN;

-- Create a trigger to ensure all messages with captions get properly processed
CREATE OR REPLACE FUNCTION public.xdelo_process_pending_messages(
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  message_id uuid,
  caption text,
  media_group_id text,
  processed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message record;
  v_sync_result jsonb;
  v_processed boolean;
  v_correlation_id text := gen_random_uuid()::text;
BEGIN
  -- Find pending messages with captions
  FOR v_message IN
    SELECT 
      id, 
      caption, 
      media_group_id
    FROM messages
    WHERE 
      processing_state = 'pending'
      AND caption IS NOT NULL 
      AND caption != ''
      AND analyzed_content IS NULL
      AND deleted_from_telegram = false
    ORDER BY updated_at ASC
    LIMIT p_limit
  LOOP
    BEGIN
      -- First try to sync from media group if applicable
      IF v_message.media_group_id IS NOT NULL THEN
        v_sync_result := xdelo_check_media_group_content(
          v_message.media_group_id,
          v_message.id,
          v_correlation_id
        );
        
        -- If sync was successful, mark as processed
        IF (v_sync_result->>'success')::boolean THEN
          v_processed := true;
        ELSE
          -- If sync failed, try to process directly
          UPDATE messages
          SET 
            processing_state = 'processing',
            processing_started_at = NOW(),
            updated_at = NOW()
          WHERE id = v_message.id;
          
          -- Log the processing attempt
          INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            correlation_id,
            metadata,
            event_timestamp
          ) VALUES (
            'message_processing_started',
            v_message.id,
            v_correlation_id,
            jsonb_build_object(
              'caption_length', length(v_message.caption),
              'media_group_id', v_message.media_group_id,
              'trigger_source', 'scheduled_processor'
            ),
            NOW()
          );
          
          v_processed := true;
        END IF;
      ELSE
        -- Non-media group message, mark for direct processing
        UPDATE messages
        SET 
          processing_state = 'processing',
          processing_started_at = NOW(),
          updated_at = NOW()
        WHERE id = v_message.id;
        
        -- Log the processing attempt
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          correlation_id,
          metadata,
          event_timestamp
        ) VALUES (
          'message_processing_started',
          v_message.id,
          v_correlation_id,
          jsonb_build_object(
            'caption_length', length(v_message.caption),
            'trigger_source', 'scheduled_processor'
          ),
          NOW()
        );
        
        v_processed := true;
      END IF;
      
      -- Return the result
      message_id := v_message.id;
      caption := v_message.caption;
      media_group_id := v_message.media_group_id;
      processed := v_processed;
      
      RETURN NEXT;
    EXCEPTION 
      WHEN OTHERS THEN
        -- Log processing error
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          correlation_id,
          error_message,
          event_timestamp
        ) VALUES (
          'message_processing_error',
          v_message.id,
          v_correlation_id,
          SQLERRM,
          NOW()
        );
        
        -- Update message to error state
        UPDATE messages
        SET 
          processing_state = 'error',
          error_message = SQLERRM,
          last_error_at = NOW(),
          updated_at = NOW()
        WHERE id = v_message.id;
        
        -- Return the failed result
        message_id := v_message.id;
        caption := v_message.caption;
        media_group_id := v_message.media_group_id;
        processed := false;
        
        RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- Commit transaction
COMMIT;
