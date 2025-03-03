
-- Function to analyze message captions safely
CREATE OR REPLACE FUNCTION xdelo_analyze_message_caption(
  p_message_id UUID,
  p_correlation_id UUID,
  p_caption TEXT,
  p_media_group_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_error TEXT;
  v_current_timestamp TIMESTAMPTZ := now();
BEGIN
  -- Update the message state to processing
  UPDATE messages
  SET 
    processing_state = 'processing',
    processing_started_at = v_current_timestamp,
    processing_correlation_id = p_correlation_id
  WHERE id = p_message_id;
  
  -- Log the operation start
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    event_timestamp
  ) VALUES (
    'analyze_message_started',
    p_message_id,
    jsonb_build_object(
      'correlation_id', p_correlation_id,
      'caption', p_caption,
      'media_group_id', p_media_group_id
    ),
    v_current_timestamp
  );
  
  -- Call the Edge Function via HTTP instead of direct reference
  -- This is a placeholder - in the actual implementation, we'll 
  -- call the function through the JavaScript client
  
  -- For now, just return a success message
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Analysis request queued',
    'correlation_id', p_correlation_id
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Capture the error
    v_error := SQLERRM;
    
    -- Update the message with the error
    UPDATE messages
    SET 
      processing_state = 'error',
      error_message = v_error,
      last_error_at = v_current_timestamp
    WHERE id = p_message_id;
    
    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      error_message,
      metadata,
      event_timestamp
    ) VALUES (
      'analyze_message_failed',
      p_message_id,
      v_error,
      jsonb_build_object(
        'correlation_id', p_correlation_id,
        'error_details', v_error
      ),
      v_current_timestamp
    );
    
    -- Return error information
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error,
      'correlation_id', p_correlation_id
    );
END;
$$;
