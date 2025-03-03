
-- Update the function for queueing messages to handle text correlation_id
CREATE OR REPLACE FUNCTION xdelo_queue_message_for_processing(
    p_message_id UUID,
    p_correlation_id TEXT DEFAULT gen_random_uuid()::TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_id UUID;
    v_message messages;
BEGIN
    -- Check if message exists and has caption
    SELECT * INTO v_message
    FROM messages
    WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;
    
    -- Only queue messages with captions
    IF v_message.caption IS NULL OR trim(v_message.caption) = '' THEN
        RAISE EXCEPTION 'Message has no caption to process';
    END IF;
    
    -- Check if already queued and pending
    IF EXISTS (
        SELECT 1 FROM message_processing_queue 
        WHERE message_id = p_message_id 
        AND status IN ('pending', 'processing')
    ) THEN
        SELECT id INTO v_queue_id
        FROM message_processing_queue 
        WHERE message_id = p_message_id 
        AND status IN ('pending', 'processing')
        LIMIT 1;
        
        RETURN v_queue_id;
    END IF;
    
    -- Insert new queue entry
    INSERT INTO message_processing_queue (
        message_id,
        correlation_id,
        status,
        metadata
    ) VALUES (
        p_message_id,
        p_correlation_id,
        'pending',
        jsonb_build_object(
            'caption', v_message.caption,
            'media_group_id', v_message.media_group_id,
            'queue_time', NOW()
        )
    ) RETURNING id INTO v_queue_id;
    
    -- Update message processing state
    UPDATE messages
    SET 
        processing_state = 'pending',
        processing_correlation_id = p_correlation_id::uuid,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the operation
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_queued_for_processing',
        p_message_id,
        p_correlation_id,
        jsonb_build_object(
            'queue_id', v_queue_id,
            'caption_length', length(v_message.caption),
            'media_group_id', v_message.media_group_id
        ),
        NOW()
    );
    
    RETURN v_queue_id;
END;
$$;

-- Update the function for handling updated messages to store previous analyzed content
CREATE OR REPLACE FUNCTION xdelo_handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- If caption changed, this will trigger a re-analysis
    IF NEW.caption != OLD.caption OR (NEW.caption IS NOT NULL AND OLD.caption IS NULL) THEN
        -- Store previous analyzed content in the array if it exists
        IF OLD.analyzed_content IS NOT NULL THEN
            NEW.old_analyzed_content = array_append(
                COALESCE(OLD.old_analyzed_content, ARRAY[]::jsonb[]),
                OLD.analyzed_content
            );
        END IF;
        
        -- Reset analysis state
        NEW.analyzed_content = NULL;
        NEW.processing_state = 'pending';
        NEW.group_caption_synced = false;
        
        -- Add to edit history
        NEW.edit_history = COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
            'edit_date', CURRENT_TIMESTAMP,
            'previous_caption', OLD.caption,
            'new_caption', NEW.caption,
            'is_channel_post', NEW.chat_type = 'channel',
            'previous_analyzed_content', OLD.analyzed_content
        );
        
        -- Log the edit
        PERFORM xdelo_log_event(
            'message_edited'::audit_event_type,
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            jsonb_build_object('caption', OLD.caption, 'analyzed_content', OLD.analyzed_content),
            jsonb_build_object('caption', NEW.caption),
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'is_channel_post', NEW.chat_type = 'channel'
            ),
            NEW.correlation_id
        );
        
        -- If part of media group, update all related messages
        IF NEW.media_group_id IS NOT NULL THEN
            UPDATE messages
            SET 
                analyzed_content = NULL,
                processing_state = 'pending',
                group_caption_synced = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                media_group_id = NEW.media_group_id 
                AND id != NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Modify auto queue trigger function to accept text correlation_id
CREATE OR REPLACE FUNCTION xdelo_auto_queue_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue messages with captions for processing
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.caption IS NULL OR OLD.caption <> NEW.caption))) 
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
    
      -- Queue for processing using DB function with text correlation_id
      BEGIN
        PERFORM xdelo_queue_message_for_processing(NEW.id, NEW.correlation_id);
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the whole transaction
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          error_message,
          metadata,
          event_timestamp
        ) VALUES (
          'trigger_queue_error',
          NEW.id,
          SQLERRM,
          jsonb_build_object(
            'correlation_id', NEW.correlation_id,
            'caption', NEW.caption,
            'error_detail', SQLSTATE
          ),
          NOW()
        );
      END;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;
