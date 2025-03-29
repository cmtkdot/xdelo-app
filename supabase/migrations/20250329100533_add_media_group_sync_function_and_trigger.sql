-- Function to sync analyzed_content across a media group
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(p_message_id uuid, p_analyzed_content jsonb, p_force_sync boolean DEFAULT true, p_sync_edit_history boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

-- Trigger function to call the main sync logic
CREATE OR REPLACE FUNCTION public.handle_message_update_sync_group()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check if analyzed_content was updated and media_group_id exists
    IF TG_OP = 'UPDATE' AND NEW.analyzed_content IS NOT NULL AND NEW.media_group_id IS NOT NULL AND
       (OLD.analyzed_content IS NULL OR OLD.analyzed_content != NEW.analyzed_content) THEN
        
        -- Call the sync function, passing the updated message's ID and content
        -- Use default values for force_sync (true) and sync_edit_history (false)
        PERFORM public.xdelo_sync_media_group_content(NEW.id, NEW.analyzed_content);
        
    END IF;
    RETURN NEW; -- Return value is ignored for AFTER trigger, but required
END;
$$;

-- Trigger definition
-- Drop existing trigger first if it exists, to avoid errors during re-runs
DROP TRIGGER IF EXISTS trg_sync_media_group_after_update ON public.messages;

-- Create the trigger
CREATE TRIGGER trg_sync_media_group_after_update
AFTER UPDATE ON public.messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL AND (OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content)) -- Fire only if analyzed_content changes for a group message
EXECUTE FUNCTION public.handle_message_update_sync_group();
