--
--
--
--
-- FIX: Update xdelo_process_caption_workflow function to correctly call sync_media_group_content
--

CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
        p_message_id uuid,
        p_correlation_id text DEFAULT NULL::text,
        p_force boolean DEFAULT false
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_message messages;
v_caption TEXT;
v_media_group_id TEXT;
v_analyzed_content JSONB;
v_correlation_uuid uuid;
v_parse_result JSONB;
BEGIN -- Convert correlation_id to UUID if provided, otherwise generate new one
v_correlation_uuid := CASE
    WHEN p_correlation_id IS NOT NULL THEN CASE
        WHEN p_correlation_id::uuid IS NOT NULL THEN p_correlation_id::uuid
        ELSE gen_random_uuid()
    END
    ELSE gen_random_uuid()
END;
-- Get the message
SELECT * INTO v_message
FROM messages
WHERE id = p_message_id;
IF v_message IS NULL THEN RETURN jsonb_build_object(
    'success',
    FALSE,
    'message',
    'Message not found',
    'message_id',
    p_message_id
);
END IF;
-- Reset processing state regardless of previous status
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
    )
VALUES (
        'message_processing_started',
        p_message_id,
        v_correlation_uuid::text,
        jsonb_build_object(
            'processor',
            'xdelo_process_caption_workflow',
            'start_time',
            NOW(),
            'force',
            p_force
        ),
        NOW()
    );
v_caption := v_message.caption;
v_media_group_id := v_message.media_group_id;
-- Check if caption exists
IF v_caption IS NULL
OR v_caption = '' THEN -- For messages without caption, keep in processing state
IF v_media_group_id IS NULL THEN -- Not part of media group - just update state
UPDATE messages
SET processing_state = 'processing',
    updated_at = NOW()
WHERE id = p_message_id;
RETURN jsonb_build_object(
    'success',
    TRUE,
    'message',
    'No caption to process, kept in processing state',
    'message_id',
    p_message_id
);
ELSE -- For media group messages without caption, sync from group
RETURN xdelo_check_media_group_content(
    v_media_group_id,
    p_message_id,
    v_correlation_uuid::text
);
END IF;
END IF;
-- We have a caption - parse it directly
v_parse_result := xdelo_parse_caption(
    p_message_id,
    v_caption,
    v_correlation_uuid::text
);
-- Update message with parsed content
UPDATE messages
SET processing_state = 'completed',
    processing_completed_at = NOW(),
    analyzed_content = v_parse_result,
    is_original_caption = CASE
        WHEN v_media_group_id IS NOT NULL THEN true
        ELSE is_original_caption
    END,
    updated_at = NOW()
WHERE id = p_message_id;
-- If part of media group, sync the parsed content
IF v_media_group_id IS NOT NULL THEN -- FIX: Call with correct parameter types
PERFORM xdelo_sync_media_group_content(
    p_message_id,
    -- First param should be uuid (message_id)
    v_parse_result,
    -- Second param should be jsonb (analyzed_content)
    true,
    -- Third param should be boolean (force_sync)
    false -- Fourth param should be boolean (sync_edit_history)
);
END IF;
RETURN jsonb_build_object(
    'success',
    TRUE,
    'message_id',
    p_message_id,
    'media_group_id',
    v_media_group_id,
    'is_media_group',
    v_media_group_id IS NOT NULL,
    'caption',
    v_caption,
    'correlation_id',
    v_correlation_uuid,
    'parsed_content',
    v_parse_result
);
EXCEPTION
WHEN OTHERS THEN -- Update to error state
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
    )
VALUES (
        'message_processing_error',
        p_message_id,
        v_correlation_uuid::text,
        SQLERRM,
        jsonb_build_object(
            'processor',
            'xdelo_process_caption_workflow',
            'error_time',
            NOW()
        ),
        NOW()
    );
RETURN jsonb_build_object(
    'success',
    FALSE,
    'message_id',
    p_message_id,
    'error',
    SQLERRM
);
END;
$function$;
-- Create a compatibility function that accepts the old signature
-- This serves as a bridge between old code that calls with (media_group_id, message_id, correlation_id)
-- and the new function that expects (message_id, analyzed_content, force_sync, sync_edit_history)
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
        p_media_group_id text,
        p_message_id uuid,
        p_correlation_id text
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_message record;
v_analyzed_content jsonb;
BEGIN -- Get the message and its analyzed content
SELECT * INTO v_message
FROM messages
WHERE id = p_message_id;
IF NOT FOUND THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Message not found',
    'message_id',
    p_message_id
);
END IF;
v_analyzed_content := v_message.analyzed_content;
-- Return error if no analyzed content
IF v_analyzed_content IS NULL THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'No analyzed content to sync',
    'message_id',
    p_message_id,
    'media_group_id',
    p_media_group_id
);
END IF;
-- Call the correct implementation with the right parameter types
RETURN xdelo_sync_media_group_content(
    p_message_id,
    -- First param: message_id uuid
    v_analyzed_content,
    -- Second param: analyzed_content jsonb
    true,
    -- Third param: force_sync boolean
    false -- Fourth param: sync_edit_history boolean
);
END;
$function$;
-- Add or replace the function to check media group content
-- This function handles the case of a message without caption in a media group
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_content(
        p_media_group_id text,
        p_message_id uuid,
        p_correlation_id text
    ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE v_source_message record;
v_analyzed_content jsonb;
v_result jsonb;
BEGIN -- Check if any other message in this media group has analyzed content
SELECT m.* INTO v_source_message
FROM messages m
WHERE m.media_group_id = p_media_group_id
    AND m.id != p_message_id
    AND m.analyzed_content IS NOT NULL
    AND m.processing_state = 'completed'
ORDER BY m.is_original_caption DESC,
    -- Prefer messages marked as original caption
    m.created_at ASC -- Otherwise take the oldest
LIMIT 1;
IF NOT FOUND THEN -- No message with analyzed content found in the group yet
-- Just mark as pending and wait for other messages to be processed
UPDATE messages
SET processing_state = 'pending',
    updated_at = NOW()
WHERE id = p_message_id;
RETURN jsonb_build_object(
    'success',
    true,
    'message_id',
    p_message_id,
    'media_group_id',
    p_media_group_id,
    'status',
    'pending',
    'info',
    'No analyzed content found in media group yet'
);
END IF;
-- We found a message with analyzed content, sync from it
UPDATE messages
SET analyzed_content = v_source_message.analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    is_original_caption = false,
    group_caption_synced = true,
    message_caption_id = v_source_message.id,
    updated_at = NOW()
WHERE id = p_message_id;
-- Log the sync operation
INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    )
VALUES (
        'media_group_content_synced',
        p_message_id,
        p_correlation_id,
        jsonb_build_object(
            'media_group_id',
            p_media_group_id,
            'source_message_id',
            v_source_message.id,
            'sync_type',
            'no_caption_sync'
        ),
        NOW()
    );
RETURN jsonb_build_object(
    'success',
    true,
    'message_id',
    p_message_id,
    'media_group_id',
    p_media_group_id,
    'source_message_id',
    v_source_message.id,
    'status',
    'synced'
);
EXCEPTION
WHEN OTHERS THEN -- Update to error state
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
    )
VALUES (
        'media_group_check_error',
        p_message_id,
        p_correlation_id,
        SQLERRM,
        jsonb_build_object(
            'media_group_id',
            p_media_group_id,
            'error_time',
            NOW()
        ),
        NOW()
    );
RETURN jsonb_build_object(
    'success',
    false,
    'message_id',
    p_message_id,
    'media_group_id',
    p_media_group_id,
    'error',
    SQLERRM
);
END;
$function$;
