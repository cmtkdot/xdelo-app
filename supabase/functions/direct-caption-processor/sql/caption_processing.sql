
-- Update processing state to indicate the message is being processed
CREATE OR REPLACE FUNCTION xdelo_set_message_processing(p_message_id uuid, p_correlation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET 
    processing_state = 'processing',
    processing_started_at = NOW(),
    processing_correlation_id = p_correlation_id
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
      'processor', 'direct-caption-processor',
      'start_time', NOW()
    ),
    NOW()
  );
END;
$$;

-- Get message details for processing with all necessary fields
CREATE OR REPLACE FUNCTION xdelo_get_message_for_processing(p_message_id uuid)
RETURNS TABLE(
  id uuid,
  telegram_message_id bigint,
  caption text,
  media_group_id text,
  processing_state text,
  analyzed_content jsonb,
  old_analyzed_content jsonb[],
  is_original_caption boolean,
  correlation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.telegram_message_id,
    m.caption,
    m.media_group_id,
    m.processing_state::text,
    m.analyzed_content,
    m.old_analyzed_content,
    m.is_original_caption,
    m.processing_correlation_id
  FROM messages m
  WHERE m.id = p_message_id;
END;
$$;

-- Mark message processing as completed with analyzed_content
CREATE OR REPLACE FUNCTION xdelo_complete_message_processing(p_message_id uuid, p_analyzed_content jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_media_group_id text;
  v_correlation_id uuid;
BEGIN
  -- Get the message and important metadata
  SELECT 
    media_group_id, 
    processing_correlation_id
  INTO 
    v_media_group_id, 
    v_correlation_id
  FROM messages
  WHERE id = p_message_id;
  
  -- Update the message with analyzed content and mark as completed
  UPDATE messages
  SET 
    analyzed_content = p_analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
    group_caption_synced = true,
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
    v_correlation_id::text,
    jsonb_build_object(
      'processor', 'direct-caption-processor',
      'completion_time', NOW(),
      'has_media_group', v_media_group_id IS NOT NULL
    ),
    NOW()
  );
  
  -- If the message is part of a media group, sync the content to other messages
  IF v_media_group_id IS NOT NULL THEN
    RETURN xdelo_sync_media_group_content(
      p_message_id,
      v_media_group_id,
      v_correlation_id::text,
      true -- Force sync
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Message processing completed',
      'message_id', p_message_id,
      'no_media_group', true
    );
  END IF;
END;
$$;

-- Mark message processing as failed with error information
CREATE OR REPLACE FUNCTION xdelo_fail_message_processing(p_message_id uuid, p_error_message text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id uuid;
BEGIN
  -- Get the correlation ID for logging
  SELECT processing_correlation_id INTO v_correlation_id
  FROM messages
  WHERE id = p_message_id;
  
  -- Update the message to mark as error
  UPDATE messages
  SET 
    processing_state = 'error',
    error_message = p_error_message,
    last_error_at = NOW(),
    retry_count = COALESCE(retry_count, 0) + 1,
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
    v_correlation_id::text,
    p_error_message,
    jsonb_build_object(
      'processor', 'direct-caption-processor',
      'error_time', NOW()
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', false,
    'error', p_error_message,
    'message_id', p_message_id
  );
END;
$$;
