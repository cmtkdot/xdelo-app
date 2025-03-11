
-- Function to begin a transaction
CREATE OR REPLACE FUNCTION xdelo_begin_transaction()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'transaction_id', gen_random_uuid(),
    'timestamp', NOW()
  );
END;
$$;

-- Function to commit a transaction with media group sync
CREATE OR REPLACE FUNCTION xdelo_commit_transaction_with_sync(
  p_message_id uuid, 
  p_media_group_id text, 
  p_correlation_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- If message has a media group ID, sync with group
  IF p_media_group_id IS NOT NULL THEN
    SELECT * INTO v_result
    FROM xdelo_sync_media_group_content(
      p_message_id,
      p_media_group_id,
      p_correlation_id,
      true, -- Force sync
      true  -- Sync edit history
    );
  ELSE
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Transaction committed, no media group to sync',
      'message_id', p_message_id
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to safely update a message with analyzed content in a transaction
CREATE OR REPLACE FUNCTION xdelo_update_message_with_analyzed_content(
  p_message_id uuid,
  p_analyzed_content jsonb,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_media_group_id text;
  v_result jsonb;
BEGIN
  -- Get message data
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id
  FOR UPDATE; -- Lock the row to prevent concurrent updates
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;
  
  -- Store current media_group_id for later sync
  v_media_group_id := v_message.media_group_id;
  
  -- Update the message
  UPDATE messages
  SET 
    analyzed_content = p_analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    is_original_caption = true,
    group_caption_synced = false, -- Force sync with media group later
    updated_at = NOW()
  WHERE id = p_message_id
  RETURNING * INTO v_message;
  
  -- Log the update
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_content_updated',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', v_media_group_id,
      'has_caption', v_message.caption IS NOT NULL,
      'operation', 'atomic_update'
    ),
    NOW()
  );
  
  -- Sync with media group
  IF v_media_group_id IS NOT NULL THEN
    v_result := xdelo_sync_media_group_content(
      p_message_id,
      v_media_group_id,
      p_correlation_id,
      true, -- Force sync
      true  -- Sync edit history
    );
  ELSE
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Message updated, no media group to sync',
      'message_id', p_message_id
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Function to handle a failed caption analysis with proper transaction handling
CREATE OR REPLACE FUNCTION xdelo_handle_failed_caption_analysis(
  p_message_id uuid,
  p_error_message text,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the message to error state
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
    'caption_analysis_error',
    p_message_id,
    p_correlation_id,
    p_error_message,
    jsonb_build_object(
      'operation', 'caption_analysis',
      'retry_count', (SELECT retry_count FROM messages WHERE id = p_message_id)
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
