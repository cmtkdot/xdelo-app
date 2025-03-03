
-- Drop all existing queue-related functions and recreate with unambiguous signatures
DROP FUNCTION IF EXISTS xdelo_queue_message_for_processing(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS xdelo_queue_message_for_processing(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS xdelo_get_next_message_for_processing() CASCADE;
DROP FUNCTION IF EXISTS xdelo_get_next_message_for_processing(integer) CASCADE;
DROP FUNCTION IF EXISTS xdelo_complete_message_processing(uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS xdelo_fail_message_processing(uuid, text) CASCADE;

-- Function to queue a message for processing with UNIQUE signature
CREATE OR REPLACE FUNCTION xdelo_queue_message_for_processing(
    p_message_id UUID,
    p_correlation_id TEXT
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

-- Function to get the next message for processing with UNIQUE signature
CREATE OR REPLACE FUNCTION xdelo_get_next_message_for_processing(limit_count INTEGER)
RETURNS TABLE (
    queue_id UUID,
    message_id UUID,
    correlation_id TEXT,
    caption TEXT,
    media_group_id TEXT,
    storage_path TEXT,
    mime_type TEXT,
    file_unique_id TEXT,
    public_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH selected_messages AS (
        SELECT 
            q.id AS q_id,
            q.message_id AS q_message_id,
            q.correlation_id AS q_correlation_id,
            ROW_NUMBER() OVER (ORDER BY q.created_at ASC) AS row_num
        FROM message_processing_queue q
        WHERE q.status = 'pending'
        AND q.attempts < q.max_attempts
        ORDER BY q.created_at ASC
        LIMIT limit_count
        FOR UPDATE SKIP LOCKED
    )
    SELECT 
        sm.q_id,
        sm.q_message_id,
        sm.q_correlation_id,
        m.caption,
        m.media_group_id,
        m.storage_path,
        m.mime_type,
        m.file_unique_id,
        m.public_url
    FROM selected_messages sm
    JOIN messages m ON sm.q_message_id = m.id
    WHERE sm.row_num <= limit_count;
    
    -- Update the status of the selected messages
    UPDATE message_processing_queue
    SET 
        status = 'processing',
        processing_started_at = NOW(),
        attempts = attempts + 1
    WHERE id IN (
        SELECT q_id FROM selected_messages
    );
    
    -- Update the message state
    UPDATE messages
    SET 
        processing_state = 'processing',
        processing_started_at = NOW()
    WHERE id IN (
        SELECT q_message_id FROM selected_messages
    );
END;
$$;

-- Function to complete message processing with UNIQUE signature
CREATE OR REPLACE FUNCTION xdelo_complete_message_processing(
    p_queue_id UUID,
    p_analyzed_content JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_correlation_id TEXT;
    v_media_group_id TEXT;
BEGIN
    -- Get the necessary data
    SELECT message_id, correlation_id, metadata->>'media_group_id' 
    INTO v_message_id, v_correlation_id, v_media_group_id
    FROM message_processing_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE message_processing_queue
    SET 
        status = 'completed',
        processing_completed_at = NOW(),
        metadata = metadata || jsonb_build_object('analyzed_content', p_analyzed_content)
    WHERE id = p_queue_id;
    
    -- Update the message with analyzed content and mark as the original caption holder for the group
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed',
        processing_completed_at = NOW(),
        is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the completion
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_completed',
        v_message_id,
        v_correlation_id,
        jsonb_build_object(
            'queue_id', p_queue_id,
            'media_group_id', v_media_group_id,
            'product_name', p_analyzed_content->>'product_name',
            'vendor_uid', p_analyzed_content->>'vendor_uid'
        ),
        NOW()
    );
    
    -- If this is part of a media group, sync the analyzed content to other messages
    IF v_media_group_id IS NOT NULL THEN
        -- Update all other messages in the group
        UPDATE messages
        SET 
            analyzed_content = p_analyzed_content,
            processing_state = 'completed',
            group_caption_synced = true,
            message_caption_id = v_message_id,
            processing_completed_at = NOW(),
            updated_at = NOW()
        WHERE 
            media_group_id = v_media_group_id 
            AND id != v_message_id;
            
        -- Log the sync operation
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            metadata,
            correlation_id,
            event_timestamp
        ) VALUES (
            'media_group_synced',
            v_message_id,
            jsonb_build_object(
                'media_group_id', v_media_group_id,
                'source_message_id', v_message_id
            ),
            v_correlation_id,
            NOW()
        );
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Function to mark message processing as failed with UNIQUE signature
CREATE OR REPLACE FUNCTION xdelo_fail_message_processing(
    p_queue_id UUID,
    p_error_message TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_correlation_id TEXT;
    v_attempts INT;
    v_max_attempts INT;
BEGIN
    -- Get the necessary data
    SELECT message_id, correlation_id, attempts, max_attempts
    INTO v_message_id, v_correlation_id, v_attempts, v_max_attempts
    FROM message_processing_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE message_processing_queue
    SET 
        status = CASE WHEN v_attempts >= v_max_attempts THEN 'failed' ELSE 'pending' END,
        error_message = p_error_message,
        last_error_at = NOW(),
        metadata = metadata || jsonb_build_object('last_error', p_error_message)
    WHERE id = p_queue_id;
    
    -- Update the message state
    UPDATE messages
    SET 
        processing_state = CASE WHEN v_attempts >= v_max_attempts THEN 'error' ELSE 'pending' END,
        error_message = p_error_message,
        last_error_at = NOW(),
        retry_count = COALESCE(retry_count, 0) + 1,
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the failure
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        CASE WHEN v_attempts >= v_max_attempts THEN 'message_processing_failed' ELSE 'message_processing_retry' END,
        v_message_id,
        v_correlation_id,
        p_error_message,
        jsonb_build_object(
            'queue_id', p_queue_id,
            'attempts', v_attempts,
            'max_attempts', v_max_attempts
        ),
        NOW()
    );
    
    RETURN TRUE;
END;
$$;

-- Update the auto queue trigger function to ensure it passes TEXT to the correct function
CREATE OR REPLACE FUNCTION xdelo_auto_queue_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue messages with captions for processing
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.caption IS NULL OR OLD.caption <> NEW.caption))) 
     AND NEW.caption IS NOT NULL AND trim(NEW.caption) <> '' THEN
      
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
    
      -- Queue for processing with explicit text parameter
      BEGIN
        -- Explicitly convert correlation_id to TEXT to match our function signature
        PERFORM xdelo_queue_message_for_processing(
          NEW.id, 
          COALESCE(NEW.correlation_id::TEXT, gen_random_uuid()::TEXT)
        );
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
  
  RETURN NEW;
END;
$$;

-- Apply the trigger to the messages table
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;
CREATE TRIGGER xdelo_auto_queue_messages_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_auto_queue_messages();
