-- Migration to fix JSONB type inconsistency in the upsert_media_message function
-- Addresses the error: "COALESCE types JSONB and jsonb cannot be matched"

CREATE OR REPLACE FUNCTION upsert_media_message(
    p_telegram_message_id BIGINT,
    p_chat_id BIGINT,
    p_chat_type telegram_chat_type,
    p_chat_title TEXT,
    p_media_group_id TEXT,
    p_caption TEXT,
    p_file_id TEXT,
    p_file_unique_id TEXT,
    p_public_url TEXT,
    p_mime_type TEXT,
    p_file_size BIGINT,
    p_storage_path TEXT,
    p_media_type TEXT,
    p_extension TEXT,
    p_message_data JSONB,
    p_message_date TIMESTAMP WITH TIME ZONE,
    p_correlation_id TEXT DEFAULT NULL,
    p_analyzed_content JSONB DEFAULT NULL,
    p_is_forward BOOLEAN DEFAULT FALSE,
    p_forward_info JSONB DEFAULT NULL,
    p_additional_updates JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_result UUID;
    v_existing_record_id UUID;
    v_caption_changed BOOLEAN := FALSE;
    v_existing_caption TEXT;
    v_processing_state processing_state_type := 'initialized';
    v_old_analyzed_content JSONB;
    v_updates JSONB := '{}'::JSONB;
    v_content_array JSONB; -- Changed to JSONB type
BEGIN
    -- Check if record with this file_unique_id already exists
    SELECT id, caption, analyzed_content
    INTO v_existing_record_id, v_existing_caption, v_old_analyzed_content
    FROM messages
    WHERE file_unique_id = p_file_unique_id;
    
    -- Add additional updates if provided
    IF p_additional_updates IS NOT NULL THEN
        v_updates := p_additional_updates;
    END IF;
    
    IF v_existing_record_id IS NOT NULL THEN
        -- Check if caption has changed (handle NULL values safely)
        IF (p_caption IS NULL AND v_existing_caption IS NOT NULL) OR
           (p_caption IS NOT NULL AND v_existing_caption IS NULL) OR
           (p_caption IS NOT NULL AND v_existing_caption IS NOT NULL AND p_caption <> v_existing_caption) THEN
            v_caption_changed := TRUE;
            
            -- If caption changed, reset processing state to trigger reprocessing
            v_processing_state := 'initialized';
            
            -- Preserve existing analyzed content in old_analyzed_content array
            IF v_old_analyzed_content IS NOT NULL THEN
                -- Check if old_analyzed_content is already an array
                IF jsonb_typeof(v_old_analyzed_content) = 'array' THEN
                    -- It's already an array, use it as is
                    v_updates := v_updates || jsonb_build_object('old_analyzed_content', v_old_analyzed_content);
                ELSE
                    -- Initialize old_analyzed_content as array if null or not an array
                    -- Use an array constructor to avoid reassignment error
                    v_updates := v_updates || jsonb_build_object('old_analyzed_content', jsonb_build_array(v_old_analyzed_content));
                END IF;
            ELSE
                -- If null, initialize with an empty array
                v_updates := v_updates || jsonb_build_object('old_analyzed_content', '[]'::JSONB);
            END IF;
            
            -- Include processing_state in updates
            v_updates := v_updates || jsonb_build_object('processing_state', v_processing_state);
            
            -- Log the caption change in audit logs
            PERFORM log_audit_event(
                'caption_change',
                p_chat_id,
                p_telegram_message_id,
                NULL,
                p_file_unique_id,
                p_media_group_id,
                v_existing_record_id,
                'messages',
                'caption_change',
                p_correlation_id,
                jsonb_build_object(
                    'old_caption', v_existing_caption,
                    'new_caption', p_caption
                ),
                NULL,
                NULL,
                NULL
            );
        END IF;
        
        -- Update existing record
        UPDATE messages
        SET 
            telegram_message_id = p_telegram_message_id,
            chat_id = p_chat_id,
            chat_type = p_chat_type,
            chat_title = p_chat_title,
            media_group_id = p_media_group_id,
            caption = p_caption,
            file_id = p_file_id,
            public_url = COALESCE(p_public_url, public_url),
            mime_type = COALESCE(p_mime_type, mime_type),
            file_size = COALESCE(p_file_size, file_size),
            storage_path = COALESCE(p_storage_path, storage_path),
            media_type = COALESCE(p_media_type, media_type),
            extension = COALESCE(p_extension, extension),
            message_data = p_message_data,
            updated_at = NOW(),
            caption_data = p_analyzed_content,
            is_forward = COALESCE(p_is_forward, is_forward),
            forward_info = COALESCE(p_forward_info, forward_info),
            correlation_id = COALESCE(p_correlation_id, correlation_id),
            message_date = COALESCE(p_message_date, message_date)
        WHERE id = v_existing_record_id;
        
        -- If we have additional updates, apply them
        IF v_updates <> '{}'::JSONB THEN
            -- Fixed JSONB array handling
            UPDATE messages
            SET 
                processing_state = CASE 
                    WHEN v_updates ? 'processing_state' 
                    THEN (v_updates->>'processing_state')::processing_state_type 
                    ELSE processing_state 
                END,
                old_analyzed_content = CASE 
                    WHEN v_updates ? 'old_analyzed_content' 
                    THEN (v_updates->'old_analyzed_content') 
                    ELSE old_analyzed_content 
                END,
                analyzed_content = CASE 
                    WHEN v_updates ? 'analyzed_content' 
                    THEN (v_updates->'analyzed_content') 
                    ELSE analyzed_content 
                END
            WHERE id = v_existing_record_id;
        END IF;
        
        -- Propagate caption changes to all messages in the same media group if present
        IF v_caption_changed AND p_media_group_id IS NOT NULL THEN
            UPDATE messages
            SET 
                caption = p_caption,
                processing_state = v_processing_state,
                updated_at = NOW()
            WHERE 
                media_group_id = p_media_group_id AND
                id <> v_existing_record_id;
        END IF;
        
        v_result := v_existing_record_id;
    ELSE
        -- Insert new record
        INSERT INTO messages (
            telegram_message_id,
            chat_id,
            chat_type,
            chat_title,
            media_group_id,
            caption,
            file_id,
            file_unique_id,
            public_url,
            mime_type,
            file_size,
            storage_path,
            media_type,
            extension,
            message_data,
            caption_data,
            analyzed_content,
            processing_state,
            is_forward,
            forward_info,
            correlation_id,
            message_date
        ) VALUES (
            p_telegram_message_id,
            p_chat_id,
            p_chat_type,
            p_chat_title,
            p_media_group_id,
            p_caption,
            p_file_id,
            p_file_unique_id,
            p_public_url,
            p_mime_type,
            p_file_size,
            p_storage_path,
            p_media_type,
            p_extension,
            p_message_data,
            p_analyzed_content,
            p_analyzed_content,
            'initialized',
            p_is_forward,
            p_forward_info,
            p_correlation_id,
            p_message_date
        ) RETURNING id INTO v_result;
        
        -- Log the message creation in audit logs
        PERFORM log_audit_event(
            'message_created',
            p_chat_id,
            p_telegram_message_id,
            NULL,
            p_file_unique_id,
            p_media_group_id,
            v_result,
            'messages',
            'message_create',
            p_correlation_id,
            jsonb_build_object(
                'mime_type', p_mime_type,
                'has_caption', p_caption IS NOT NULL,
                'is_forward', p_is_forward
            ),
            NULL,
            NULL,
            NULL
        );
    END IF;
    
    -- Return the ID of the inserted/updated record
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Update migration tracking
INSERT INTO migration_history (version, name, applied_at, description)
VALUES (
    '10.1',
    'fix-jsonb-array-handling',
    NOW(),
    'Fixed JSONB array type handling in upsert_media_message'
);
