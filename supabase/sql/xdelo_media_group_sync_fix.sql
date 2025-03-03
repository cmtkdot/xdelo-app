
-- Drop all versions of the conflicting function to start with a clean slate
DO $$
BEGIN
  -- Drop all versions of xdelo_sync_media_group_content to avoid conflicts
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(uuid, text);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(text, uuid);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(text, uuid, text);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(uuid, text, text);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(uuid);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(text);

  -- Drop related triggers and functions
  DROP TRIGGER IF EXISTS xdelo_trg_sync_media_group_content ON messages;
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_analyzed_content();
END $$;

-- Create a single, well-defined version of the function with clear parameter names
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
  p_source_message_id UUID,
  p_media_group_id TEXT,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
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

  -- Get the source message with analyzed content
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message not found',
      'message_id', p_source_message_id
    );
  END IF;
  
  -- Verify source message has analyzed content
  IF v_source_message.analyzed_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message has no analyzed content',
      'message_id', p_source_message_id
    );
  END IF;
  
  -- Mark source message as the original caption holder
  UPDATE messages
  SET 
    is_original_caption = true,
    group_caption_synced = true,
    updated_at = NOW()
  WHERE id = p_source_message_id;
  
  -- Update all other messages in the group with the analyzed content
  UPDATE messages
  SET 
    analyzed_content = v_source_message.analyzed_content,
    processing_state = 'completed',
    group_caption_synced = true,
    message_caption_id = p_source_message_id,
    is_original_caption = false,
    processing_completed_at = COALESCE(processing_completed_at, NOW()),
    updated_at = NOW()
  WHERE 
    media_group_id = p_media_group_id 
    AND id != p_source_message_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Update media group metadata for all messages in the group
  WITH group_stats AS (
    SELECT 
      COUNT(*) as message_count,
      MIN(created_at) as first_message_time,
      MAX(created_at) as last_message_time
    FROM messages
    WHERE media_group_id = p_media_group_id
  )
  UPDATE messages m
  SET
    group_message_count = gs.message_count,
    group_first_message_time = gs.first_message_time,
    group_last_message_time = gs.last_message_time,
    updated_at = NOW()
  FROM group_stats gs
  WHERE m.media_group_id = p_media_group_id;
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    correlation_id,
    event_timestamp
  ) VALUES (
    'media_group_content_synced',
    p_source_message_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id,
      'updated_messages_count', v_updated_count,
      'operation', 'sync_group'
    ),
    p_correlation_id,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id, 
    'updated_count', v_updated_count,
    'correlation_id', p_correlation_id
  );
EXCEPTION
  WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      error_message,
      metadata,
      correlation_id,
      event_timestamp
    ) VALUES (
      'media_group_sync_error',
      p_source_message_id,
      v_error,
      jsonb_build_object(
        'media_group_id', p_media_group_id,
        'operation', 'sync_group'
      ),
      p_correlation_id,
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error,
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for existing analyzed content in a media group
-- and sync it to a newly arrived message
CREATE OR REPLACE FUNCTION xdelo_check_media_group_content(
  p_media_group_id TEXT,
  p_message_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_source_message_id UUID;
  v_analyzed_content JSONB;
  v_result JSONB;
BEGIN
  -- Input validation
  IF p_media_group_id IS NULL OR p_media_group_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_media_group_id',
      'message_id', p_message_id
    );
  END IF;
  
  -- Find a message in the group with analyzed content
  SELECT id, analyzed_content INTO v_source_message_id, v_analyzed_content
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND analyzed_content IS NOT NULL
    AND id != p_message_id
  ORDER BY is_original_caption DESC, created_at ASC
  LIMIT 1;
  
  -- If no message with analyzed content found, return early
  IF v_source_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_analyzed_content_in_group',
      'media_group_id', p_media_group_id
    );
  END IF;
  
  -- Update the new message with the existing analyzed content
  UPDATE messages
  SET 
    analyzed_content = v_analyzed_content,
    processing_state = 'completed',
    group_caption_synced = true,
    message_caption_id = v_source_message_id,
    is_original_caption = false,
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the sync
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_content_copied',
    p_message_id,
    jsonb_build_object(
      'source_message_id', v_source_message_id,
      'media_group_id', p_media_group_id
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'source_message_id', v_source_message_id,
    'media_group_id', p_media_group_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'error',
      'error', SQLERRM,
      'media_group_id', p_media_group_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
