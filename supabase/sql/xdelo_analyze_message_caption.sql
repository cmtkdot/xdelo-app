
-- Function to analyze message captions safely without cross-database references
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
  v_file_unique_id TEXT;
  v_public_url TEXT;
  v_storage_path TEXT;
BEGIN
  -- First check if the message exists and get file info
  SELECT file_unique_id, public_url, storage_path INTO v_file_unique_id, v_public_url, v_storage_path
  FROM messages
  WHERE id = p_message_id;
  
  IF v_file_unique_id IS NULL THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;
  
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
      'media_group_id', p_media_group_id,
      'file_unique_id', v_file_unique_id,
      'public_url', v_public_url
    ),
    v_current_timestamp
  );
  
  -- Prepare response to be used by Edge Function
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Analysis request queued',
    'correlation_id', p_correlation_id,
    'message_id', p_message_id,
    'file_info', jsonb_build_object(
      'file_unique_id', v_file_unique_id,
      'public_url', v_public_url,
      'storage_path', v_storage_path
    )
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
      last_error_at = v_current_timestamp,
      retry_count = COALESCE(retry_count, 0) + 1
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

-- Create a function to handle file existence checking and public URL generation
CREATE OR REPLACE FUNCTION xdelo_get_or_create_file_url(
  p_file_unique_id TEXT,
  p_mime_type TEXT DEFAULT 'image/jpeg'
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_public_url TEXT;
  v_extension TEXT;
BEGIN
  -- Check if we already have this file
  SELECT public_url INTO v_public_url
  FROM messages
  WHERE file_unique_id = p_file_unique_id
  AND public_url IS NOT NULL
  LIMIT 1;
  
  -- If we found an existing URL, return it
  IF v_public_url IS NOT NULL THEN
    RETURN v_public_url;
  END IF;
  
  -- Extract extension from mime_type
  IF p_mime_type IS NOT NULL THEN
    v_extension := split_part(p_mime_type, '/', 2);
  ELSE
    v_extension := 'jpeg'; -- Default extension
  END IF;
  
  -- Generate the public URL
  v_public_url := 'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || 
                p_file_unique_id || '.' || v_extension;
  
  RETURN v_public_url;
END;
$$;

-- Function to flag files for redownload
CREATE OR REPLACE FUNCTION xdelo_flag_file_for_redownload(
  p_message_id UUID,
  p_reason TEXT DEFAULT 'file_missing'
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_success BOOLEAN := false;
BEGIN
  -- Update the message to indicate it needs redownload
  UPDATE messages
  SET 
    needs_redownload = true,
    redownload_reason = p_reason,
    redownload_attempts = COALESCE(redownload_attempts, 0),
    redownload_flagged_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the redownload flag
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    event_timestamp
  ) VALUES (
    'file_redownload_flagged',
    p_message_id,
    jsonb_build_object(
      'reason', p_reason,
      'flagged_at', NOW()
    ),
    NOW()
  );
  
  v_success := true;
  RETURN v_success;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to sync media group content
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
  p_media_group_id TEXT,
  p_source_message_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_message messages;
  v_result JSONB;
  v_updated_count INTEGER;
  v_correlation_id UUID := gen_random_uuid();
BEGIN
  -- Get the source message
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
  
  -- Update all other messages in the group
  UPDATE messages
  SET 
    analyzed_content = v_source_message.analyzed_content,
    processing_state = 'completed',
    group_caption_synced = true,
    message_caption_id = p_source_message_id,
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE 
    media_group_id = p_media_group_id 
    AND id != p_source_message_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    correlation_id,
    event_timestamp
  ) VALUES (
    'media_group_synced',
    p_source_message_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id,
      'updated_messages_count', v_updated_count
    ),
    v_correlation_id,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id,
    'updated_count', v_updated_count,
    'correlation_id', v_correlation_id
  );
END;
$$;

-- Drop unused/redundant functions
DROP FUNCTION IF EXISTS invoke_edge_function_for_messages();
DROP FUNCTION IF EXISTS xdelo_process_pending_captions();
DROP FUNCTION IF EXISTS xdelo_extract_analyzed_at(jsonb);

-- Add column for file redownload tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'needs_redownload'
  ) THEN
    ALTER TABLE messages ADD COLUMN needs_redownload BOOLEAN DEFAULT false;
    ALTER TABLE messages ADD COLUMN redownload_reason TEXT;
    ALTER TABLE messages ADD COLUMN redownload_attempts INTEGER DEFAULT 0;
    ALTER TABLE messages ADD COLUMN redownload_flagged_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN redownload_completed_at TIMESTAMPTZ;
  END IF;
END
$$;
