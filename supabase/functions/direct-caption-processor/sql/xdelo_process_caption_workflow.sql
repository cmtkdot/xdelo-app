
-- Consolidated caption processing workflow function
CREATE OR REPLACE FUNCTION xdelo_process_caption_workflow(
  p_message_id UUID,
  p_correlation_id UUID DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_caption TEXT;
  v_media_group_id TEXT;
  v_analyzed_content JSONB;
  v_result JSONB;
BEGIN
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
  
  -- Use existing correlation ID if provided is NULL
  p_correlation_id := COALESCE(p_correlation_id, gen_random_uuid());
  
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
    p_correlation_id::text,
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
      -- For media group messages without caption, check if we can sync from another message
      RETURN xdelo_check_media_group_content(
        p_media_group_id, 
        p_message_id, 
        p_correlation_id::text
      );
    END IF;
  END IF;
  
  -- We have a caption, mark the message for edge function processing
  UPDATE messages
  SET processing_state = 'pending',
      is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
      updated_at = NOW()
  WHERE id = p_message_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message_id', p_message_id,
    'media_group_id', v_media_group_id,
    'is_media_group', v_media_group_id IS NOT NULL,
    'caption', v_caption,
    'correlation_id', p_correlation_id,
    'ready_for_edge_function', TRUE
  );
EXCEPTION
  WHEN OTHERS THEN
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
      p_correlation_id::text,
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
$$;

-- Create a helper function to check and sync media group content
CREATE OR REPLACE FUNCTION xdelo_check_media_group_content(
  p_media_group_id TEXT,
  p_message_id UUID,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_message_id UUID;
  v_sync_result JSONB;
BEGIN
  -- Find a message in the group with analyzed content
  SELECT id INTO v_source_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND id != p_message_id
    AND analyzed_content IS NOT NULL
    AND processing_state = 'completed'
  ORDER BY is_original_caption DESC NULLS LAST, created_at ASC
  LIMIT 1;
  
  -- If found, sync content from that message
  IF v_source_message_id IS NOT NULL THEN
    v_sync_result := xdelo_sync_media_group_content(
      v_source_message_id,
      p_media_group_id,
      p_correlation_id,
      TRUE
    );
    
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Synced content from existing media group message',
      'source_message_id', v_source_message_id,
      'message_id', p_message_id,
      'media_group_id', p_media_group_id,
      'sync_result', v_sync_result
    );
  END IF;
  
  -- No message with analyzed content found
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'No analyzed content found in media group to sync',
    'message_id', p_message_id,
    'media_group_id', p_media_group_id,
    'reason', 'no_source_content'
  );
END;
$$;
