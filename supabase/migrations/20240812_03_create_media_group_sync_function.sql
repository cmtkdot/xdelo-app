
-- Start transaction
BEGIN;

-- Create consolidated media group sync function with improved error handling and advisory locks
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
  p_source_message_id uuid,
  p_media_group_id text,
  p_correlation_id text DEFAULT NULL,
  p_force_sync boolean DEFAULT false,
  p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_message messages;
  v_target_count integer := 0;
  v_advisory_lock_key bigint;
  v_updated_at timestamptz;
  v_group_message_count integer;
  v_group_first_message_time timestamptz;
  v_group_last_message_time timestamptz;
BEGIN
  -- Validate inputs
  IF p_media_group_id IS NULL OR p_media_group_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No media group ID provided',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  -- Fetch source message
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Source message not found',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  -- Check if source message has analyzed content
  IF v_source_message.analyzed_content IS NULL AND NOT p_force_sync THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Source message has no analyzed content',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  -- Get advisory lock to prevent concurrent syncs of the same media group
  v_advisory_lock_key := ('x'||substring(p_media_group_id::text from 1 for 16))::bit(64)::bigint;
  IF NOT pg_try_advisory_xact_lock(v_advisory_lock_key) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Another sync operation is in progress for this media group',
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id
    );
  END IF;
  
  -- Mark source message as original caption holder
  UPDATE messages
  SET 
    is_original_caption = true,
    group_caption_synced = true,
    updated_at = NOW()
  WHERE id = p_source_message_id;
  
  -- Update all other messages in the group with the analyzed content
  WITH updates AS (
    UPDATE messages
    SET 
      analyzed_content = v_source_message.analyzed_content,
      message_caption_id = p_source_message_id,
      is_original_caption = false,
      group_caption_synced = true,
      processing_state = 'completed',
      processing_completed_at = NOW(),
      old_analyzed_content = CASE 
        WHEN p_sync_edit_history AND v_source_message.old_analyzed_content IS NOT NULL 
        THEN v_source_message.old_analyzed_content 
        ELSE old_analyzed_content 
      END,
      edit_history = CASE 
        WHEN p_sync_edit_history AND v_source_message.edit_history IS NOT NULL 
        THEN v_source_message.edit_history
        ELSE edit_history
      END,
      updated_at = NOW()
    WHERE 
      media_group_id = p_media_group_id
      AND id != p_source_message_id
      AND (p_force_sync OR analyzed_content IS NULL OR analyzed_content IS DISTINCT FROM v_source_message.analyzed_content)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_target_count FROM updates;
  
  -- Update media group metadata
  WITH group_stats AS (
    SELECT 
      COUNT(*) as msg_count,
      MIN(created_at) as first_msg_time,
      MAX(created_at) as last_msg_time
    FROM messages
    WHERE media_group_id = p_media_group_id
  )
  SELECT 
    msg_count, first_msg_time, last_msg_time
  INTO 
    v_group_message_count, v_group_first_message_time, v_group_last_message_time
  FROM group_stats;
  
  -- Update all messages in the group with the group metadata
  UPDATE messages
  SET 
    group_message_count = v_group_message_count,
    group_first_message_time = v_group_first_message_time,
    group_last_message_time = v_group_last_message_time,
    updated_at = NOW()
  WHERE media_group_id = p_media_group_id;
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_synced',
    p_source_message_id,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'target_count', v_target_count,
      'total_group_size', v_group_message_count,
      'forced_sync', p_force_sync,
      'synced_edit_history', p_sync_edit_history
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Media group content synced successfully',
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id,
    'target_count', v_target_count,
    'total_group_size', v_group_message_count
  );
EXCEPTION 
  WHEN OTHERS THEN
    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      error_message,
      metadata,
      event_timestamp
    ) VALUES (
      'media_group_sync_error',
      p_source_message_id,
      p_correlation_id,
      SQLERRM,
      jsonb_build_object(
        'media_group_id', p_media_group_id,
        'error_detail', SQLSTATE,
        'error_context', jsonb_build_object(
          'function', 'xdelo_sync_media_group_content',
          'source_message_id', p_source_message_id,
          'forced_sync', p_force_sync
        )
      ),
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error syncing media group: ' || SQLERRM,
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id,
      'error_code', SQLSTATE
    );
END;
$$;

-- Commit transaction
COMMIT;
