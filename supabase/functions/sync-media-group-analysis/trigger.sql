CREATE OR REPLACE FUNCTION public.process_media_group_analysis(
    p_message_id uuid,
    p_media_group_id text,
    p_analyzed_content jsonb,
    p_processing_completed_at timestamp with time zone
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- First, update the source message (the one with the caption)
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed'::message_processing_state,
        processing_completed_at = p_processing_completed_at,
        is_original_caption = true,
        group_caption_synced = true  -- Mark as synced
    WHERE id = p_message_id;

    -- Then, update all other messages in the group
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed'::message_processing_state,
        processing_completed_at = p_processing_completed_at,
        is_original_caption = false,
        group_caption_synced = true,  -- Mark as synced
        message_caption_id = p_message_id
    WHERE 
        media_group_id = p_media_group_id 
        AND id != p_message_id;

    -- Log the completion of group synchronization
    INSERT INTO analysis_audit_log (
        message_id,
        media_group_id,
        event_type,
        new_state,
        analyzed_content,
        processing_details
    ) VALUES (
        p_message_id,
        p_media_group_id,
        'GROUP_SYNC_COMPLETED',
        'completed',
        p_analyzed_content,
        jsonb_build_object(
            'sync_timestamp', NOW(),
            'group_size', (
                SELECT COUNT(*)
                FROM messages
                WHERE media_group_id = p_media_group_id
            )
        )
    );
END;
$$;

-- Create a trigger to handle group synchronization after analysis
CREATE OR REPLACE FUNCTION public.sync_media_group_after_analysis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed if this is a message with analyzed content in a media group
    IF NEW.media_group_id IS NOT NULL 
       AND NEW.analyzed_content IS NOT NULL 
       AND NEW.analyzed_content != OLD.analyzed_content THEN
        
        -- Call the process_media_group_analysis function
        PERFORM process_media_group_analysis(
            NEW.id,
            NEW.media_group_id,
            NEW.analyzed_content,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_media_group_after_analysis ON messages;
CREATE TRIGGER trg_sync_media_group_after_analysis
    AFTER UPDATE OF analyzed_content
    ON messages
    FOR EACH ROW
    WHEN (NEW.analyzed_content IS NOT NULL AND NEW.analyzed_content IS DISTINCT FROM OLD.analyzed_content)
    EXECUTE FUNCTION sync_media_group_after_analysis();