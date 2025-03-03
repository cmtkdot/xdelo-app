
-- Create a message processing queue table to manage the processing state
CREATE TABLE IF NOT EXISTS message_processing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    correlation_id UUID DEFAULT gen_random_uuid(),
    error TEXT,
    last_error_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Index for faster querying
CREATE INDEX IF NOT EXISTS idx_message_processing_queue_status ON message_processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_processing_queue_message_id ON message_processing_queue(message_id);

-- Function to queue a message for processing
CREATE OR REPLACE FUNCTION xdelo_queue_message_for_processing(
    p_message_id UUID,
    p_correlation_id UUID DEFAULT gen_random_uuid()
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
        processing_correlation_id = p_correlation_id,
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
CREATE OR REPLACE FUNCTION xdelo_get_next_message_for_processing()
RETURNS TABLE (
    queue_id UUID,
    message_id UUID,
    correlation_id UUID,
    caption TEXT,
    media_group_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_record RECORD;
BEGIN
    -- Select and lock the next pending message
    FOR v_queue_record IN
        SELECT q.id, q.message_id, q.correlation_id, m.caption, m.media_group_id
        FROM message_processing_queue q
        JOIN messages m ON q.message_id = m.id
        WHERE q.status = 'pending'
        AND (q.attempts < q.max_attempts)
        ORDER BY q.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Update the queue record
        UPDATE message_processing_queue
        SET 
            status = 'processing',
            processing_started_at = NOW(),
            attempts = attempts + 1
        WHERE id = v_queue_record.id;
        
        -- Update the message state
        UPDATE messages
        SET 
            processing_state = 'processing',
            processing_started_at = NOW()
        WHERE id = v_queue_record.message_id;
        
        -- Return the record for processing
        queue_id := v_queue_record.id;
        message_id := v_queue_record.message_id;
        correlation_id := v_queue_record.correlation_id;
        caption := v_queue_record.caption;
        media_group_id := v_queue_record.media_group_id;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Function to complete message processing successfully
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
    v_correlation_id UUID;
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
    
    -- Update the message with analyzed content
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed',
        processing_completed_at = NOW(),
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
        PERFORM xdelo_sync_media_group_content(v_media_group_id, v_message_id);
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Function to mark message processing as failed
CREATE OR REPLACE FUNCTION xdelo_fail_message_processing(
    p_queue_id UUID,
    p_error TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_correlation_id UUID;
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
        error = p_error,
        last_error_at = NOW(),
        metadata = metadata || jsonb_build_object('last_error', p_error)
    WHERE id = p_queue_id;
    
    -- Update the message state
    UPDATE messages
    SET 
        processing_state = CASE WHEN v_attempts >= v_max_attempts THEN 'error' ELSE 'pending' END,
        error_message = p_error,
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
        p_error,
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

-- Create a trigger to automatically queue messages with captions
CREATE OR REPLACE FUNCTION xdelo_auto_queue_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Queue messages with captions for processing
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.caption <> NEW.caption)) 
       AND NEW.caption IS NOT NULL AND trim(NEW.caption) <> '' THEN
        
        -- Only if not already completed
        IF NEW.processing_state IS NULL OR NEW.processing_state IN ('initialized', 'pending', 'error') THEN
            PERFORM xdelo_queue_message_for_processing(NEW.id, NEW.correlation_id);
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Apply the trigger to the messages table
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;
CREATE TRIGGER xdelo_auto_queue_messages_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_auto_queue_messages();

-- Remove the old trigger that tried to directly call the edge function
DROP TRIGGER IF EXISTS monitor_mssages_table ON messages;
