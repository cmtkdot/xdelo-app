-- XdeloMedia Core Database Functions Migration (Part 1)
-- This script creates the core database functions needed for the application

-- Function for upserting media messages with proper handling of caption changes
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
    v_content_array JSONB; -- New variable to hold array version
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
                -- Initialize old_analyzed_content as array if null or not an array
                SELECT jsonb_build_array(v_old_analyzed_content)
                INTO v_old_analyzed_content;
                
                -- Set the old_analyzed_content in the updates
                v_updates := v_updates || jsonb_build_object('old_analyzed_content', v_old_analyzed_content);
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
            message_data = COALESCE(p_message_data, message_data),
            media_type = COALESCE(p_media_type, media_type),
            extension = COALESCE(p_extension, extension),
            updated_at = CURRENT_TIMESTAMP,
            analyzed_content = CASE WHEN v_caption_changed THEN NULL ELSE COALESCE(p_analyzed_content, analyzed_content) END,
            is_forward = p_is_forward,
            forward_info = COALESCE(p_forward_info, forward_info),
            correlation_id = COALESCE(p_correlation_id, correlation_id),
            message_date = COALESCE(p_message_date, message_date)
        WHERE id = v_existing_record_id;
        
        -- If we have additional updates, apply them
        IF v_updates <> '{}'::JSONB THEN
            UPDATE messages
            SET 
                processing_state = COALESCE((v_updates->>'processing_state')::processing_state_type, processing_state),
                old_analyzed_content = COALESCE((v_updates->>'old_analyzed_content')::JSONB, old_analyzed_content)
            WHERE id = v_existing_record_id;
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
            message_data,
            media_type,
            extension,
            analyzed_content,
            correlation_id,
            is_forward,
            forward_info,
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
            p_message_data,
            p_media_type,
            p_extension,
            p_analyzed_content,
            p_correlation_id,
            p_is_forward,
            p_forward_info,
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
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function for upserting text messages with proper handling of edits
CREATE OR REPLACE FUNCTION upsert_text_message(
    p_telegram_message_id BIGINT,
    p_chat_id BIGINT,
    p_chat_type telegram_chat_type,
    p_chat_title TEXT,
    p_message_type TEXT,
    p_message_text TEXT,
    p_telegram_data JSONB,
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
    v_text_changed BOOLEAN := FALSE;
    v_existing_text TEXT;
    v_processing_state processing_state_type := 'initialized';
    v_old_analyzed_content JSONB;
    v_updates JSONB := '{}'::JSONB;
    v_is_edited BOOLEAN := FALSE;
    v_edit_date TIMESTAMP WITH TIME ZONE;
    v_edit_history JSONB;
    v_edit_count INTEGER;
BEGIN
    -- Check if record with this telegram_message_id and chat_id already exists
    SELECT id, message_text, analyzed_content, is_edited, edit_date, edit_history, edit_count
    INTO v_existing_record_id, v_existing_text, v_old_analyzed_content, v_is_edited, v_edit_date, v_edit_history, v_edit_count
    FROM other_messages
    WHERE telegram_message_id = p_telegram_message_id AND chat_id = p_chat_id;
    
    -- Add additional updates if provided
    IF p_additional_updates IS NOT NULL THEN
        v_updates := p_additional_updates;
    END IF;
    
    IF v_existing_record_id IS NOT NULL THEN
        -- Check if text has changed (handle NULL values safely)
        IF (p_message_text IS NULL AND v_existing_text IS NOT NULL) OR
           (p_message_text IS NOT NULL AND v_existing_text IS NULL) OR
           (p_message_text IS NOT NULL AND v_existing_text IS NOT NULL AND p_message_text <> v_existing_text) THEN
            v_text_changed := TRUE;
            
            -- If text changed, reset processing state to trigger reprocessing
            v_processing_state := 'initialized';
            
            -- Update edit tracking fields
            v_is_edited := TRUE;
            v_edit_date := CURRENT_TIMESTAMP;
            v_edit_count := COALESCE(v_edit_count, 0) + 1;
            
            -- Create or update edit history
            IF v_edit_history IS NULL THEN
                v_edit_history := jsonb_build_array(
                    jsonb_build_object(
                        'previous_text', v_existing_text,
                        'edit_date', v_edit_date
                    )
                );
            ELSE
                v_edit_history := v_edit_history || jsonb_build_object(
                    'previous_text', v_existing_text,
                    'edit_date', v_edit_date
                );
            END IF;
            
            -- Preserve existing analyzed content in old_analyzed_content array
            IF v_old_analyzed_content IS NOT NULL THEN
                -- Initialize old_analyzed_content as array if null or not an array
                SELECT jsonb_build_array(v_old_analyzed_content)
                INTO v_old_analyzed_content;
                
                -- Set the old_analyzed_content in the updates
                v_updates := v_updates || jsonb_build_object('old_analyzed_content', v_old_analyzed_content);
            END IF;
            
            -- Include processing_state in updates
            v_updates := v_updates || jsonb_build_object(
                'processing_state', v_processing_state,
                'is_edited', v_is_edited,
                'edit_date', v_edit_date,
                'edit_history', v_edit_history,
                'edit_count', v_edit_count
            );
            
            -- Log the text change in audit logs
            PERFORM xdelo_log_audit_event(
                'message_edited',
                p_chat_id,
                p_telegram_message_id,
                NULL,
                NULL,
                NULL,
                v_existing_record_id,
                'other_messages',
                'message_edit',
                p_correlation_id,
                jsonb_build_object(
                    'old_text', v_existing_text,
                    'new_text', p_message_text,
                    'edit_count', v_edit_count
                ),
                NULL,
                NULL,
                NULL
            );
        END IF;
        
        -- Update existing record
        UPDATE other_messages
        SET 
            message_type = p_message_type,
            chat_type = p_chat_type,
            chat_title = p_chat_title,
            message_text = p_message_text,
            telegram_data = COALESCE(p_telegram_data, telegram_data),
            updated_at = CURRENT_TIMESTAMP,
            analyzed_content = CASE WHEN v_text_changed THEN NULL ELSE COALESCE(p_analyzed_content, analyzed_content) END,
            is_forward = p_is_forward,
            forward_info = COALESCE(p_forward_info, forward_info),
            correlation_id = COALESCE(p_correlation_id, correlation_id),
            message_date = COALESCE(p_message_date, message_date)
        WHERE id = v_existing_record_id;
        
        -- If we have additional updates, apply them
        IF v_updates <> '{}'::JSONB THEN
            UPDATE other_messages
            SET 
                processing_state = COALESCE((v_updates->>'processing_state')::processing_state_type, processing_state),
                old_analyzed_content = COALESCE((v_updates->>'old_analyzed_content')::JSONB, old_analyzed_content),
                is_edited = COALESCE((v_updates->>'is_edited')::BOOLEAN, is_edited),
                edit_date = COALESCE((v_updates->>'edit_date')::TIMESTAMP WITH TIME ZONE, edit_date),
                edit_history = COALESCE((v_updates->>'edit_history')::JSONB, edit_history),
                edit_count = COALESCE((v_updates->>'edit_count')::INTEGER, edit_count)
            WHERE id = v_existing_record_id;
        END IF;
        
        v_result := v_existing_record_id;
    ELSE
        -- Insert new record
        INSERT INTO other_messages (
            telegram_message_id,
            chat_id,
            chat_type,
            chat_title,
            message_type,
            message_text,
            telegram_data,
            analyzed_content,
            correlation_id,
            is_forward,
            forward_info,
            message_date
        ) VALUES (
            p_telegram_message_id,
            p_chat_id,
            p_chat_type,
            p_chat_title,
            p_message_type,
            p_message_text,
            p_telegram_data,
            p_analyzed_content,
            p_correlation_id,
            p_is_forward,
            p_forward_info,
            p_message_date
        ) RETURNING id INTO v_result;
        
        -- Log the message creation in audit logs
        PERFORM xdelo_log_audit_event(
            'message_created',
            p_chat_id,
            p_telegram_message_id,
            NULL,
            NULL,
            NULL,
            v_result,
            'other_messages',
            'message_create',
            p_correlation_id,
            jsonb_build_object(
                'message_type', p_message_type,
                'is_forward', p_is_forward
            ),
            NULL,
            NULL,
            NULL
        );
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function for logging audit events
-- Renamed to log_audit_event (removed xdelo_ prefix) to clean up legacy code
CREATE OR REPLACE FUNCTION log_audit_event(
    p_event_type audit_event_type,
    p_chat_id BIGINT DEFAULT NULL,
    p_message_id BIGINT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_file_unique_id TEXT DEFAULT NULL,
    p_media_group_id TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_operation_type message_operation_type DEFAULT NULL,
    p_correlation_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_previous_state JSONB DEFAULT NULL,
    p_new_state JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_result UUID;
    v_start_time TIMESTAMP WITH TIME ZONE;
    v_processing_time DOUBLE PRECISION;
BEGIN
    v_start_time := clock_timestamp();
    
    INSERT INTO unified_audit_logs (
        event_type,
        chat_id,
        message_id,
        user_id,
        file_unique_id,
        media_group_id,
        entity_id,
        entity_type,
        operation_type,
        correlation_id,
        metadata,
        previous_state,
        new_state,
        error_message
    ) VALUES (
        p_event_type,
        p_chat_id,
        p_message_id,
        p_user_id,
        p_file_unique_id,
        p_media_group_id,
        p_entity_id,
        p_entity_type,
        p_operation_type,
        p_correlation_id,
        p_metadata,
        p_previous_state,
        p_new_state,
        p_error_message
    ) RETURNING id INTO v_result;
    
    v_processing_time := extract(epoch from (clock_timestamp() - v_start_time)) * 1000; -- in milliseconds
    
    -- Update the processing time
    UPDATE unified_audit_logs
    SET processing_time = v_processing_time
    WHERE id = v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Create backward compatibility function for xdelo_log_audit_event
CREATE OR REPLACE FUNCTION xdelo_log_audit_event(
    p_event_type audit_event_type,
    p_chat_id BIGINT DEFAULT NULL,
    p_message_id BIGINT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_file_unique_id TEXT DEFAULT NULL,
    p_media_group_id TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_operation_type message_operation_type DEFAULT NULL,
    p_correlation_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_previous_state JSONB DEFAULT NULL,
    p_new_state JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
BEGIN
    -- Call the new function without the xdelo_ prefix
    RETURN log_audit_event(
        p_event_type,
        p_chat_id,
        p_message_id,
        p_user_id,
        p_file_unique_id,
        p_media_group_id,
        p_entity_id,
        p_entity_type,
        p_operation_type,
        p_correlation_id,
        p_metadata,
        p_previous_state,
        p_new_state,
        p_error_message
    );
END;
$$ LANGUAGE plpgsql;
