
-- This file creates a simplified message queue system

-- First, drop the existing queue and related functions to start fresh
-- Add CASCADE to drop dependent objects
DROP FUNCTION IF EXISTS xdelo_queue_message_for_processing CASCADE;
DROP FUNCTION IF EXISTS xdelo_get_next_message_for_processing CASCADE;
DROP FUNCTION IF EXISTS xdelo_complete_message_processing CASCADE;
DROP FUNCTION IF EXISTS xdelo_fail_message_processing CASCADE;
DROP FUNCTION IF EXISTS xdelo_auto_queue_messages CASCADE;
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;
DROP TABLE IF EXISTS message_processing_queue CASCADE;

-- Create a simplified message processing queue table
CREATE TABLE IF NOT EXISTS message_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    correlation_id TEXT DEFAULT gen_random_uuid()::TEXT,
    error_message TEXT,
    last_error_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_message_id ON message_processing_queue(message_id);
CREATE INDEX IF NOT EXISTS idx_message_queue_created_at ON message_processing_queue(created_at);

-- Function to check if a caption is valid for processing
CREATE OR REPLACE FUNCTION xdelo_has_valid_caption(p_caption TEXT) 
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if caption exists and isn't empty
  RETURN p_caption IS NOT NULL AND trim(p_caption) <> '';
END;
$$ LANGUAGE plpgsql;

-- Function to queue a message for processing
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

-- Function to get the next message for processing
CREATE OR REPLACE FUNCTION xdelo_get_next_message_for_processing(limit_count INT DEFAULT 1)
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

-- Function to complete message processing
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

-- Function to mark message processing as failed
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

-- Function to automatically queue messages with captions
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
        PERFORM xdelo_queue_message_for_processing(NEW.id, NEW.correlation_id::TEXT);
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

-- Create a function to find unprocessed messages with captions and queue them
CREATE OR REPLACE FUNCTION xdelo_queue_unprocessed_messages(limit_count INT DEFAULT 10)
RETURNS TABLE (
    message_id UUID,
    queued BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH unprocessed_messages AS (
        SELECT id 
        FROM messages
        WHERE caption IS NOT NULL 
        AND trim(caption) <> ''
        AND (processing_state IS NULL OR processing_state IN ('pending', 'error'))
        AND NOT EXISTS (
            SELECT 1 FROM message_processing_queue 
            WHERE message_id = messages.id 
            AND status IN ('pending', 'processing')
        )
        ORDER BY created_at DESC
        LIMIT limit_count
    )
    SELECT 
        id,
        TRUE AS queued,
        NULL::TEXT AS error_message
    FROM unprocessed_messages
    WHERE xdelo_queue_message_for_processing(id) IS NOT NULL;

    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY
        SELECT 
            NULL::UUID,
            FALSE,
            SQLERRM;
END;
$$;

-- Create a view for monitoring the queue status
CREATE OR REPLACE VIEW v_queue_status AS
SELECT 
    status,
    COUNT(*) as message_count,
    MIN(created_at) as oldest_message,
    MAX(created_at) as newest_message,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at)))::INTEGER as avg_age_seconds
FROM message_processing_queue
GROUP BY status;

