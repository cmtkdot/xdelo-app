-- Function to process media group analysis
CREATE OR REPLACE FUNCTION process_media_group_analysis(
  p_message_id UUID,
  p_media_group_id TEXT,
  p_analyzed_content JSONB,
  p_processing_completed_at TIMESTAMPTZ,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS void AS $$
DECLARE
    v_lock_obtained BOOLEAN;
BEGIN
    -- Try to obtain advisory lock using media_group_id hash
    SELECT pg_try_advisory_xact_lock(hashtext(p_media_group_id)) INTO v_lock_obtained;
    
    IF NOT v_lock_obtained THEN
        RAISE EXCEPTION 'Could not obtain lock for media group %', p_media_group_id;
    END IF;

    -- Update the source message
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'analysis_synced',
        processing_completed_at = p_processing_completed_at,
        is_original_caption = true,
        group_caption_synced = true
    WHERE id = p_message_id;

    -- Update all other messages in the group
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'analysis_synced',
        processing_completed_at = p_processing_completed_at,
        is_original_caption = false,
        group_caption_synced = true,
        message_caption_id = p_message_id
    WHERE 
        media_group_id = p_media_group_id 
        AND id != p_message_id;

    -- Mark group as completed if all messages are synced
    IF NOT EXISTS (
        SELECT 1 
        FROM messages 
        WHERE media_group_id = p_media_group_id 
        AND (processing_state != 'analysis_synced' OR NOT group_caption_synced)
    ) THEN
        UPDATE messages
        SET processing_state = 'completed'
        WHERE media_group_id = p_media_group_id;
    END IF;
END;
$$ LANGUAGE plpgsql;