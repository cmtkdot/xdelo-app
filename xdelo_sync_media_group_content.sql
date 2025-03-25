-- Improved function for syncing media group content without advisory lock
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
    p_source_message_id uuid, 
    p_media_group_id text, 
    p_correlation_id text DEFAULT NULL,
    p_force_sync boolean DEFAULT false,
    p_sync_edit_history boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_source_message messages;
  v_result JSONB;
  v_updated_count INTEGER := 0;
  v_error TEXT;
BEGIN
  -- Input validation
  IF p_source_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message ID cannot be null',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  IF p_media_group_id IS NULL OR p_media_group_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Media group ID cannot be null or empty',
      'media_group_id', p_media_group_id
    );
  END IF;

  -- Get the source message data
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id;
  
  -- Check if source message exists
  IF v_source_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message not found',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  -- Check if source message belongs to specified media group
  IF v_source_message.media_group_id != p_media_group_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message does not belong to specified media group',
      'source_message_id', p_source_message_id,
      'media_group_id', p_media_group_id,
      'actual_media_group_id', v_source_message.media_group_id
    );
  END IF;

  -- Update all messages in the media group with caption and analyzed_content from source message
  BEGIN
    UPDATE messages
    SET 
      caption = v_source_message.caption,
      analyzed_content = v_source_message.analyzed_content,
      processing_state = CASE 
        WHEN v_source_message.processing_state = 'completed' THEN 'completed'
        ELSE processing_state
      END,
      processing_completed_at = CASE 
        WHEN v_source_message.processing_state = 'completed' THEN v_source_message.processing_completed_at
        ELSE processing_completed_at
      END,
      edit_history = CASE
        WHEN p_sync_edit_history THEN v_source_message.edit_history
        ELSE edit_history
      END,
      is_edited = CASE
        WHEN p_sync_edit_history THEN v_source_message.is_edited
        ELSE is_edited
      END,
      updated_at = NOW()
    WHERE 
      media_group_id = p_media_group_id
      AND id != p_source_message_id
      AND (
        p_force_sync = true 
        OR caption IS NULL 
        OR caption = '' 
        OR analyzed_content IS NULL 
        OR processing_state != 'completed'
      );
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Log the operation if correlation_id provided
    IF p_correlation_id IS NOT NULL THEN
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        correlation_id
      ) VALUES (
        'media_group_sync',
        p_source_message_id,
        jsonb_build_object(
          'media_group_id', p_media_group_id,
          'updated_count', v_updated_count,
          'force_sync', p_force_sync,
          'sync_edit_history', p_sync_edit_history
        ),
        p_correlation_id
      );
    END IF;
    
    v_result := jsonb_build_object(
      'success', true,
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id,
      'updated_count', v_updated_count
    );
    
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    
    v_result := jsonb_build_object(
      'success', false,
      'error', v_error,
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id
    );
  END;
  
  RETURN v_result;
END;
$$; 