
-- Start transaction
BEGIN;

-- Create function to check if a message can inherit analyzed content from its media group
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_content(
  p_media_group_id text, 
  p_message_id uuid, 
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_has_caption boolean;
  v_analyzed_message_id uuid;
  v_analyzed_content jsonb;
  v_target_updated boolean := false;
BEGIN
  -- Skip if no media group ID
  IF p_media_group_id IS NULL OR p_media_group_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_media_group_id',
      'message_id', p_message_id
    );
  END IF;
  
  -- Check if this message has a caption (we don't want to overwrite caption holders)
  SELECT caption IS NOT NULL AND caption != '' INTO v_message_has_caption
  FROM messages 
  WHERE id = p_message_id;

  IF v_message_has_caption THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'message_has_caption',
      'message_id', p_message_id,
      'should_analyze', true
    );
  END IF;
  
  -- Find any message in the group with analyzed content
  SELECT id, analyzed_content INTO v_analyzed_message_id, v_analyzed_content
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND analyzed_content IS NOT NULL
    AND id != p_message_id
    AND deleted_from_telegram = false
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF FOUND THEN
    -- Update the target message with the analyzed content
    UPDATE messages
    SET 
      analyzed_content = v_analyzed_content,
      message_caption_id = v_analyzed_message_id,
      is_original_caption = false,
      group_caption_synced = true,
      processing_state = 'completed',
      processing_completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_message_id;
    
    GET DIAGNOSTICS v_target_updated = ROW_COUNT;
    
    IF v_target_updated THEN
      -- Log the sync operation
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        correlation_id,
        event_timestamp
      ) VALUES (
        'media_group_content_synced',
        p_message_id,
        jsonb_build_object(
          'media_group_id', p_media_group_id,
          'source_message_id', v_analyzed_message_id,
          'operation', 'check_and_sync'
        ),
        p_correlation_id,
        NOW()
      );
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Content synced from media group',
        'source_message_id', v_analyzed_message_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'reason', 'no_analyzed_content_in_group'
  );
EXCEPTION 
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'error',
      'error', SQLERRM
    );
END;
$$;

-- Commit transaction
COMMIT;
