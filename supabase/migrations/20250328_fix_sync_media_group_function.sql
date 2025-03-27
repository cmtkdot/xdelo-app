
-- Fix the media group sync function signature issue
-- The function is being called with wrong parameter types, so we'll create a new version
-- with the correct signature

CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
    p_message_id uuid,
    p_analyzed_content jsonb,
    p_force_sync boolean DEFAULT true,
    p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_message record;
    v_media_group_id text;
    v_correlation_id text;
    v_updated_count integer := 0;
    v_error text;
BEGIN
    -- Get the message and important metadata
    SELECT * INTO v_message
    FROM messages
    WHERE id = p_message_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Message not found',
            'message_id', p_message_id
        );
    END IF;
    
    v_media_group_id := v_message.media_group_id;
    v_correlation_id := COALESCE(v_message.correlation_id, gen_random_uuid()::text);
    
    -- Return early if no media group
    IF v_media_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No media group to sync',
            'message_id', p_message_id,
            'no_media_group', true
        );
    END IF;
    
    -- Update the source message with analyzed content
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed',
        processing_completed_at = NOW(),
        is_original_caption = true,
        group_caption_synced = true,
        message_caption_id = p_message_id,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the completion
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_completed',
        p_message_id,
        v_correlation_id,
        jsonb_build_object(
            'processor', 'sync_media_group_content',
            'completion_time', NOW(),
            'has_media_group', true,
            'is_source', true
        ),
        NOW()
    );
    
    -- Update all other messages in the group with the analyzed content
    WITH updated_messages AS (
        UPDATE messages
        SET 
            analyzed_content = p_analyzed_content,
            processing_state = 'completed',
            group_caption_synced = true,
            message_caption_id = p_message_id,
            is_original_caption = false,
            processing_completed_at = COALESCE(processing_completed_at, NOW()),
            updated_at = NOW(),
            -- Only sync edit history if requested
            old_analyzed_content = CASE 
                WHEN p_sync_edit_history AND v_message.old_analyzed_content IS NOT NULL 
                THEN v_message.old_analyzed_content
                ELSE old_analyzed_content
            END
        WHERE 
            media_group_id = v_media_group_id
            AND id != p_message_id
            AND (p_force_sync = true OR group_caption_synced = false OR analyzed_content IS NULL)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_messages;

    -- Update media group metadata for all messages
    WITH group_stats AS (
        SELECT 
            COUNT(*) as message_count,
            MIN(created_at) as first_message_time,
            MAX(created_at) as last_message_time
        FROM messages
        WHERE media_group_id = v_media_group_id
    )
    UPDATE messages m
    SET
        group_message_count = gs.message_count,
        group_first_message_time = gs.first_message_time,
        group_last_message_time = gs.last_message_time,
        updated_at = NOW()
    FROM group_stats gs
    WHERE m.media_group_id = v_media_group_id;

    -- Log the sync operation
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'media_group_content_synced',
        p_message_id,
        v_correlation_id,
        jsonb_build_object(
            'media_group_id', v_media_group_id,
            'updated_messages_count', v_updated_count,
            'force_sync', p_force_sync,
            'sync_edit_history', p_sync_edit_history
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'media_group_id', v_media_group_id,
        'source_message_id', p_message_id, 
        'updated_count', v_updated_count
    );
    
EXCEPTION WHEN OTHERS THEN 
    v_error := SQLERRM;

    -- Log error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        'media_group_sync_error',
        p_message_id,
        v_correlation_id,
        v_error,
        jsonb_build_object(
            'media_group_id', v_media_group_id,
            'error', v_error
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', false,
        'error', v_error,
        'media_group_id', v_media_group_id,
        'source_message_id', p_message_id
    );
END;
$function$;

-- Create a backwards compatibility function for the old signature
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
    p_source_message_id uuid,
    p_media_group_id text,
    p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_message record;
    v_analyzed_content jsonb;
BEGIN
    -- Get the message data
    SELECT * INTO v_message
    FROM messages
    WHERE id = p_source_message_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Source message not found',
            'message_id', p_source_message_id
        );
    END IF;
    
    v_analyzed_content := v_message.analyzed_content;
    
    -- Check if we have analyzed content
    IF v_analyzed_content IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No analyzed content to sync',
            'message_id', p_source_message_id
        );
    END IF;
    
    -- Call the new function with the correct parameters
    RETURN xdelo_sync_media_group_content(
        p_source_message_id,      -- message_id
        v_analyzed_content,       -- analyzed_content
        true,                     -- force_sync
        false                     -- sync_edit_history
    );
END;
$function$;

-- Create a simple database function to extend query timeout
CREATE OR REPLACE FUNCTION public.xdelo_set_statement_timeout(p_timeout_ms integer DEFAULT 30000)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    EXECUTE format('SET statement_timeout TO %s', p_timeout_ms);
END;
$function$;

-- Create a function to retry operations with exponential backoff
CREATE OR REPLACE FUNCTION public.xdelo_retry_operation(
    p_max_attempts integer DEFAULT 3,
    p_initial_delay_ms integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_attempt integer := 0;
    v_delay integer := p_initial_delay_ms;
    v_result jsonb;
    v_success boolean := false;
BEGIN
    WHILE v_attempt < p_max_attempts AND NOT v_success LOOP
        v_attempt := v_attempt + 1;
        
        BEGIN
            -- Set a longer timeout for complex operations
            PERFORM xdelo_set_statement_timeout(30000);
            
            -- Return success template - calling function must replace this
            v_result := jsonb_build_object(
                'success', true,
                'attempt', v_attempt,
                'message', 'Operation completed successfully'
            );
            v_success := true;
            
        EXCEPTION WHEN OTHERS THEN
            -- Record the error
            v_result := jsonb_build_object(
                'success', false,
                'attempt', v_attempt,
                'error', SQLERRM,
                'sqlstate', SQLSTATE
            );
            
            -- Only retry if not on last attempt
            IF v_attempt < p_max_attempts THEN
                -- Exponential backoff
                PERFORM pg_sleep(v_delay / 1000.0);
                v_delay := v_delay * 2;
            END IF;
        END;
    END LOOP;
    
    RETURN v_result;
END;
$function$;
