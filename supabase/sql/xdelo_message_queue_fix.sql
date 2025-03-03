
-- Fix for the window function error in message queue processing
-- Replace the function with one that doesn't use window functions with FOR UPDATE

CREATE OR REPLACE FUNCTION xdelo_get_messages_for_processing(limit_count INT DEFAULT 5)
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
    -- First select the IDs of eligible messages
    FOR v_queue_record IN
        SELECT 
            q.id AS queue_id,
            q.message_id,
            q.correlation_id,
            m.caption,
            m.media_group_id
        FROM message_processing_queue q
        JOIN messages m ON q.message_id = m.id
        WHERE q.status = 'pending'
        AND q.attempts < q.max_attempts
        ORDER BY q.created_at ASC
        LIMIT limit_count
        FOR UPDATE OF q SKIP LOCKED
    LOOP
        -- Update the queue record
        UPDATE message_processing_queue
        SET 
            status = 'processing',
            processing_started_at = NOW(),
            attempts = attempts + 1
        WHERE id = v_queue_record.queue_id;
        
        -- Update the message state
        UPDATE messages
        SET 
            processing_state = 'processing',
            processing_started_at = NOW()
        WHERE id = v_queue_record.message_id;
        
        -- Return the record for processing
        queue_id := v_queue_record.queue_id;
        message_id := v_queue_record.message_id;
        correlation_id := v_queue_record.correlation_id;
        caption := v_queue_record.caption;
        media_group_id := v_queue_record.media_group_id;
        
        RETURN NEXT;
    END LOOP;
END;
$$;

-- Add a function to check and sync media group content for messages without captions
CREATE OR REPLACE FUNCTION xdelo_check_media_group_content(
    p_media_group_id TEXT,
    p_message_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_found_content JSONB;
    v_source_message_id UUID;
BEGIN
    -- Check if this is a valid media group
    IF p_media_group_id IS NULL OR trim(p_media_group_id) = '' THEN
        RETURN FALSE;
    END IF;
    
    -- Find a message in the group that has analyzed content
    SELECT 
        m.analyzed_content,
        m.id
    INTO 
        v_found_content,
        v_source_message_id
    FROM messages m
    WHERE 
        m.media_group_id = p_media_group_id
        AND m.id != p_message_id
        AND m.analyzed_content IS NOT NULL
        AND m.processing_state = 'completed'
    ORDER BY 
        m.processing_completed_at ASC
    LIMIT 1;
    
    -- If we found analyzed content, sync it to the current message
    IF v_found_content IS NOT NULL THEN
        UPDATE messages
        SET 
            analyzed_content = v_found_content,
            processing_state = 'completed',
            processing_completed_at = NOW(),
            message_caption_id = v_source_message_id,
            is_original_caption = FALSE,
            group_caption_synced = TRUE
        WHERE 
            id = p_message_id;
            
        -- Log the sync
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            metadata
        ) VALUES (
            'media_group_content_synced',
            p_message_id,
            jsonb_build_object(
                'media_group_id', p_media_group_id,
                'source_message_id', v_source_message_id
            )
        );
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Create a dedicated function for syncing media group content from a source message
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
    p_media_group_id TEXT,
    p_source_message_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_content JSONB;
    v_synced_count INT := 0;
BEGIN
    -- Check if this is a valid media group
    IF p_media_group_id IS NULL OR trim(p_media_group_id) = '' THEN
        RETURN 0;
    END IF;
    
    -- Get the content from the source message
    SELECT analyzed_content INTO v_source_content
    FROM messages
    WHERE id = p_source_message_id;
    
    IF v_source_content IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Mark the source message as original
    UPDATE messages
    SET is_original_caption = TRUE
    WHERE id = p_source_message_id;
    
    -- Sync the analyzed content to all other messages in the group
    WITH updated AS (
        UPDATE messages
        SET 
            analyzed_content = v_source_content,
            processing_state = 'completed',
            processing_completed_at = NOW(),
            message_caption_id = p_source_message_id,
            is_original_caption = FALSE,
            group_caption_synced = TRUE
        WHERE 
            media_group_id = p_media_group_id
            AND id != p_source_message_id
        RETURNING id
    )
    SELECT COUNT(*) INTO v_synced_count FROM updated;
    
    -- Log the sync
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata
    ) VALUES (
        'media_group_content_synced_from_source',
        p_source_message_id,
        jsonb_build_object(
            'media_group_id', p_media_group_id,
            'synced_message_count', v_synced_count
        )
    );
    
    RETURN v_synced_count;
END;
$$;
