
-- Add storage validation tracking
CREATE TABLE IF NOT EXISTS storage_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_unique_id TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    is_valid BOOLEAN,
    error_message TEXT,
    UNIQUE(file_unique_id)
);

-- Improve the file checking function to track validation results
CREATE OR REPLACE FUNCTION xdelo_validate_file_storage(
    p_file_unique_id TEXT,
    p_storage_path TEXT,
    p_mime_type TEXT DEFAULT 'image/jpeg'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_extension TEXT;
    v_normalized_path TEXT;
    v_result BOOLEAN := false;
BEGIN
    -- Extract extension from mime_type
    IF p_mime_type IS NOT NULL THEN
        v_extension := split_part(p_mime_type, '/', 2);
    ELSE
        v_extension := 'jpeg'; -- Default extension
    END IF;
    
    -- Normalize the storage path if needed
    IF p_storage_path IS NULL OR p_storage_path = '' THEN
        v_normalized_path := p_file_unique_id || '.' || v_extension;
    ELSE
        v_normalized_path := p_storage_path;
    END IF;
    
    -- Record the validation attempt
    INSERT INTO storage_validations (
        file_unique_id,
        storage_path,
        last_checked_at,
        is_valid,
        error_message
    ) VALUES (
        p_file_unique_id,
        v_normalized_path,
        NOW(),
        NULL, -- We'll update this
        NULL
    )
    ON CONFLICT (file_unique_id) DO UPDATE SET
        last_checked_at = NOW(),
        is_valid = NULL,
        error_message = NULL;
    
    -- The result will be updated by the edge function
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error
        UPDATE storage_validations
        SET 
            is_valid = false,
            error_message = SQLERRM
        WHERE file_unique_id = p_file_unique_id;
        
        RETURN false;
END;
$$;

-- Improve message update handling for duplicates and edits
CREATE OR REPLACE FUNCTION xdelo_handle_message_update(
    p_message_id UUID,
    p_caption TEXT,
    p_is_edit BOOLEAN DEFAULT false,
    p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message messages;
    v_result JSONB;
    v_edit_history JSONB;
BEGIN
    -- Get the current message
    SELECT * INTO v_message
    FROM messages
    WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;
    
    -- Prepare edit history if this is an edit
    IF p_is_edit THEN
        -- Initialize edit history if it doesn't exist
        IF v_message.edit_history IS NULL THEN
            v_edit_history := jsonb_build_array();
        ELSE
            v_edit_history := v_message.edit_history;
        END IF;
        
        -- Add the current state to edit history
        v_edit_history := v_edit_history || jsonb_build_object(
            'timestamp', NOW(),
            'previous_caption', v_message.caption,
            'previous_analyzed_content', v_message.analyzed_content
        );
        
        -- Update the message
        UPDATE messages
        SET 
            caption = p_caption,
            analyzed_content = NULL, -- Reset analyzed content since caption changed
            processing_state = 'pending',
            edit_history = v_edit_history,
            edit_count = COALESCE(edit_count, 0) + 1,
            edit_date = NOW(),
            is_edited = true,
            group_caption_synced = false,
            correlation_id = COALESCE(p_correlation_id, correlation_id)
        WHERE id = p_message_id;
        
        -- Log the edit
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            previous_state,
            new_state,
            metadata,
            correlation_id
        ) VALUES (
            'message_edited',
            p_message_id,
            jsonb_build_object(
                'caption', v_message.caption,
                'analyzed_content', v_message.analyzed_content
            ),
            jsonb_build_object(
                'caption', p_caption
            ),
            jsonb_build_object(
                'is_edit', true,
                'edit_count', COALESCE(v_message.edit_count, 0) + 1
            ),
            p_correlation_id
        );
        
        -- If this is part of a media group, we need to update the other messages too
        IF v_message.media_group_id IS NOT NULL THEN
            -- Update all other messages in the group
            UPDATE messages
            SET 
                analyzed_content = NULL,
                processing_state = 'pending',
                group_caption_synced = false
            WHERE 
                media_group_id = v_message.media_group_id 
                AND id != p_message_id;
        END IF;
    ELSE
        -- Just update the caption without edit history
        UPDATE messages
        SET 
            caption = p_caption,
            updated_at = NOW(),
            correlation_id = COALESCE(p_correlation_id, correlation_id)
        WHERE id = p_message_id;
    END IF;
    
    -- Return success result
    RETURN jsonb_build_object(
        'success', true,
        'message_id', p_message_id,
        'is_edit', p_is_edit
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'message_id', p_message_id,
            'error', SQLERRM
        );
END;
$$;

-- Create function to handle duplicate detection
CREATE OR REPLACE FUNCTION xdelo_handle_duplicate_detection(
    p_file_unique_id TEXT,
    p_telegram_message_id BIGINT,
    p_chat_id BIGINT,
    p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_message messages;
    v_is_duplicate BOOLEAN := false;
    v_duplicate_id UUID;
BEGIN
    -- Check if we have a message with the same file_unique_id
    SELECT * INTO v_existing_message
    FROM messages
    WHERE file_unique_id = p_file_unique_id
    AND (
        telegram_message_id != p_telegram_message_id OR
        chat_id != p_chat_id
    )
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
        v_is_duplicate := true;
        v_duplicate_id := v_existing_message.id;
        
        -- Log duplicate detection
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            metadata,
            correlation_id
        ) VALUES (
            'duplicate_detected',
            v_existing_message.id,
            jsonb_build_object(
                'file_unique_id', p_file_unique_id,
                'new_telegram_message_id', p_telegram_message_id,
                'new_chat_id', p_chat_id
            ),
            p_correlation_id
        );
    END IF;
    
    RETURN jsonb_build_object(
        'is_duplicate', v_is_duplicate,
        'original_message_id', v_duplicate_id,
        'file_unique_id', p_file_unique_id
    );
END;
$$;

-- Enhance the media group syncing function
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
    p_source_message_id UUID,
    p_media_group_id TEXT,
    p_correlation_id TEXT DEFAULT gen_random_uuid()::TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_source_message messages;
    v_result JSONB;
    v_updated_count INTEGER;
BEGIN
    -- Get the source message
    SELECT * INTO v_source_message
    FROM messages
    WHERE id = p_source_message_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Source message not found',
            'message_id', p_source_message_id
        );
    END IF;
    
    -- Update all other messages in the group
    UPDATE messages
    SET 
        analyzed_content = v_source_message.analyzed_content,
        processing_state = 'completed',
        group_caption_synced = true,
        message_caption_id = p_source_message_id,
        processing_completed_at = NOW(),
        updated_at = NOW()
    WHERE 
        media_group_id = p_media_group_id 
        AND id != p_source_message_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Mark source message as the original caption if it has one
    IF v_source_message.caption IS NOT NULL AND v_source_message.caption != '' THEN
        UPDATE messages
        SET is_original_caption = true
        WHERE id = p_source_message_id;
    END IF;
    
    -- Log the sync operation
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        correlation_id,
        event_timestamp
    ) VALUES (
        'media_group_synced',
        p_source_message_id,
        jsonb_build_object(
            'media_group_id', p_media_group_id,
            'source_message_id', p_source_message_id,
            'updated_messages_count', v_updated_count
        ),
        p_correlation_id,
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'media_group_id', p_media_group_id,
        'source_message_id', p_source_message_id,
        'updated_count', v_updated_count,
        'correlation_id', p_correlation_id
    );
END;
$$;

-- Add function to check and repair storage paths
CREATE OR REPLACE FUNCTION xdelo_repair_storage_paths() 
RETURNS TABLE(
    message_id UUID,
    old_path TEXT,
    new_path TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH updated_messages AS (
        UPDATE messages m
        SET 
            storage_path = m.file_unique_id || '.' || (
                CASE 
                    WHEN m.mime_type IS NOT NULL THEN split_part(m.mime_type, '/', 2)
                    ELSE 'jpeg'
                END
            ),
            needs_redownload = true,
            redownload_reason = 'storage_path_repair',
            redownload_flagged_at = NOW()
        WHERE 
            storage_path IS NULL OR
            storage_path = '' OR
            storage_path NOT LIKE (m.file_unique_id || '%')
        RETURNING 
            m.id, 
            m.storage_path AS new_storage_path, 
            (SELECT s.storage_path FROM messages s WHERE s.id = m.id) AS old_storage_path
    )
    SELECT 
        um.id,
        um.old_storage_path,
        um.new_storage_path,
        'repaired'::TEXT
    FROM updated_messages um;
END;
$$;
