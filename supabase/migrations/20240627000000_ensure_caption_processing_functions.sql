
-- Ensure the xdelo_handle_message_edit function exists and is properly implemented
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_edit(
    p_message_id uuid, 
    p_caption text, 
    p_is_edit boolean DEFAULT false, 
    p_correlation_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- Ensure the improved xdelo_logprocessingevent function handles non-UUID entity_ids correctly
CREATE OR REPLACE FUNCTION public.xdelo_logprocessingevent(
    p_event_type text,
    p_entity_id text,
    p_correlation_id text,
    p_metadata jsonb DEFAULT NULL::jsonb,
    p_error_message text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
    v_uuid UUID;
    v_entity_uuid UUID;
    v_metadata JSONB;
BEGIN
    -- Try to cast entity_id to UUID if it's already in UUID format
    BEGIN
        v_entity_uuid := p_entity_id::UUID;
    EXCEPTION WHEN OTHERS THEN
        -- If casting fails, generate a new UUID and store original in metadata
        v_entity_uuid := gen_random_uuid();
        
        -- Prepare metadata to include original entity ID
        v_metadata := COALESCE(p_metadata, '{}'::JSONB) || 
                     JSONB_build_object('original_entity_id', p_entity_id);
    END;
    
    -- Use the metadata we prepared, or the original if no conversion was needed
    v_metadata := COALESCE(v_metadata, p_metadata);
    
    -- Insert the log entry with the valid UUID
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message,
        event_timestamp
    ) VALUES (
        p_event_type,
        v_entity_uuid,
        p_correlation_id,
        v_metadata,
        p_error_message,
        NOW()
    )
    RETURNING id INTO v_uuid;
    
    RETURN v_uuid;
EXCEPTION WHEN OTHERS THEN
    -- Fall back to console logging if database insert fails
    RAISE NOTICE 'Failed to log event: % % %', p_event_type, p_entity_id, SQLERRM;
    RETURN NULL;
END;
$function$;

-- Ensure the xdelo_direct_caption_processing function exists
CREATE OR REPLACE FUNCTION public.xdelo_direct_caption_processing(
    p_caption text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_result jsonb;
BEGIN
    -- Call the existing parsing function
    v_result := public.xdelo_parse_caption(p_caption);
    
    -- Mark as processed by direct processing
    v_result := jsonb_set(v_result, '{parsing_metadata,processor}', '"direct_caption_processor"');
    v_result := jsonb_set(v_result, '{parsing_metadata,processing_timestamp}', to_jsonb(now()));
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'error', SQLERRM,
        'parsing_metadata', jsonb_build_object(
            'processor', 'direct_caption_processor',
            'processing_timestamp', now(),
            'success', false
        )
    );
END;
$function$;

-- Ensure process_caption_workflow exists and is properly implemented
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
    p_message_id uuid,
    p_correlation_id text DEFAULT NULL,
    p_force boolean DEFAULT false
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_message messages;
    v_caption TEXT;
    v_media_group_id TEXT;
    v_analyzed_content JSONB;
    v_correlation_uuid uuid;
BEGIN
    -- Convert correlation_id to UUID if provided, otherwise generate new one
    v_correlation_uuid := CASE 
        WHEN p_correlation_id IS NOT NULL THEN 
            CASE 
                WHEN p_correlation_id::uuid IS NOT NULL THEN p_correlation_id::uuid
                ELSE gen_random_uuid()
            END
        ELSE gen_random_uuid()
    END;

    -- Get the message
    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    
    IF v_message IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'message', 'Message not found',
            'message_id', p_message_id
        );
    END IF;
    
    -- Check if already processed and force not specified
    IF v_message.processing_state = 'completed' AND NOT p_force THEN
        RETURN jsonb_build_object(
            'success', FALSE, 
            'message', 'Message already processed',
            'message_id', p_message_id
        );
    END IF;
    
    -- Update to processing state
    UPDATE messages
    SET processing_state = 'processing',
        processing_started_at = NOW(),
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the processing start
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_started',
        p_message_id,
        v_correlation_uuid::text,
        jsonb_build_object(
            'processor', 'xdelo_process_caption_workflow',
            'start_time', NOW(),
            'caption_length', length(v_message.caption),
            'force', p_force
        ),
        NOW()
    );
    
    v_caption := v_message.caption;
    v_media_group_id := v_message.media_group_id;
    
    -- Check if caption exists
    IF v_caption IS NULL OR v_caption = '' THEN
        -- No caption to process, mark as completed if not part of a media group
        IF v_media_group_id IS NULL THEN
            UPDATE messages
            SET processing_state = 'completed',
                processing_completed_at = NOW(),
                analyzed_content = jsonb_build_object(
                    'caption', '',
                    'parsing_metadata', jsonb_build_object(
                        'method', 'empty_caption',
                        'timestamp', NOW()
                    )
                ),
                updated_at = NOW()
            WHERE id = p_message_id;
            
            RETURN jsonb_build_object(
                'success', TRUE,
                'message', 'No caption to process, marked as completed',
                'message_id', p_message_id
            );
        ELSE
            -- For media group messages without caption, sync from another message
            RETURN public.xdelo_check_media_group_content(
                v_media_group_id, 
                p_message_id, 
                v_correlation_uuid::text
            );
        END IF;
    END IF;
    
    -- Process the caption directly
    v_analyzed_content := public.xdelo_direct_caption_processing(v_caption);
    
    -- Update the message with the analyzed content
    UPDATE messages
    SET 
        processing_state = 'completed',
        processing_completed_at = NOW(),
        analyzed_content = v_analyzed_content,
        is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the processing completion
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'caption_processed',
        p_message_id,
        v_correlation_uuid::text,
        jsonb_build_object(
            'processor', 'direct_caption_processor',
            'completion_time', NOW(),
            'media_group_id', v_media_group_id
        ),
        NOW()
    );
    
    -- If this is part of a media group, sync the processed content
    IF v_media_group_id IS NOT NULL THEN
        PERFORM public.xdelo_sync_media_group_content(
            p_message_id,
            v_media_group_id,
            v_correlation_uuid::text,
            true,  -- Force sync
            false  -- Don't sync edit history for initial processing
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Caption processed successfully',
        'message_id', p_message_id,
        'media_group_id', v_media_group_id,
        'has_media_group', v_media_group_id IS NOT NULL
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Update to error state
    UPDATE messages
    SET processing_state = 'error',
        error_message = SQLERRM,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_error',
        p_message_id,
        v_correlation_uuid::text,
        SQLERRM,
        jsonb_build_object(
            'processor', 'xdelo_process_caption_workflow',
            'error_time', NOW()
        ),
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', FALSE,
        'message_id', p_message_id,
        'error', SQLERRM
    );
END;
$function$;
