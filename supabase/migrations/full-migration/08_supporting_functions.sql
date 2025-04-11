-- XdeloMedia Supporting Functions Migration
-- This script creates auxiliary functions for error handling, cleanup, and utility operations

-- Function to find a caption message within a media group
CREATE OR REPLACE FUNCTION public.xdelo_find_caption_message(p_media_group_id text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_message_id uuid;
BEGIN
    -- First try to find a message marked as original caption
    SELECT id INTO v_message_id
    FROM messages
    WHERE media_group_id = p_media_group_id
    AND is_original_caption = TRUE
    LIMIT 1;
    
    -- If no original caption marked, look for any message with a caption
    IF v_message_id IS NULL THEN
        SELECT id INTO v_message_id
        FROM messages
        WHERE media_group_id = p_media_group_id
        AND caption IS NOT NULL
        AND caption != ''
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    RETURN v_message_id;
END;
$$;

-- Function to extract media dimensions from message data
CREATE OR REPLACE FUNCTION public.extract_media_dimensions(telegram_data jsonb)
RETURNS TABLE(width integer, height integer, duration integer)
LANGUAGE plpgsql
AS $$
BEGIN
    -- For photos (get last/largest photo from array)
    IF telegram_data ? 'photo' AND jsonb_array_length(telegram_data->'photo') > 0 THEN
        SELECT INTO width, height
            (telegram_data->'photo'->-1->>'width')::integer,
            (telegram_data->'photo'->-1->>'height')::integer;
        duration := NULL;
        
    -- For videos
    ELSIF telegram_data ? 'video' THEN
        SELECT INTO width, height, duration
            (telegram_data->'video'->>'width')::integer,
            (telegram_data->'video'->>'height')::integer,
            (telegram_data->'video'->>'duration')::integer;
            
    -- For animations (GIFs)
    ELSIF telegram_data ? 'animation' THEN
        SELECT INTO width, height, duration
            (telegram_data->'animation'->>'width')::integer,
            (telegram_data->'animation'->>'height')::integer,
            (telegram_data->'animation'->>'duration')::integer;
            
    -- For documents, try to extract from thumbnail if available
    ELSIF telegram_data ? 'document' AND telegram_data->'document' ? 'thumbnail' THEN
        SELECT INTO width, height
            (telegram_data->'document'->'thumbnail'->>'width')::integer,
            (telegram_data->'document'->'thumbnail'->>'height')::integer;
        duration := NULL;
    
    ELSE
        width := NULL;
        height := NULL;
        duration := NULL;
    END IF;
    
    RETURN NEXT;
END;
$$;

-- Function to align caption and analyzed content (ensures consistency)
CREATE OR REPLACE FUNCTION public.align_caption_and_analyzed_content()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count INTEGER := 0;
    updated_count2 INTEGER := 0;
BEGIN
    -- Update records where caption_data exists but analyzed_content does not
    UPDATE public.messages
    SET analyzed_content = caption_data::jsonb
    WHERE caption_data IS NOT NULL 
    AND (analyzed_content IS NULL OR analyzed_content = 'null'::jsonb);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Update records where analyzed_content exists but caption_data does not
    WITH to_update AS (
        SELECT id, analyzed_content 
        FROM public.messages
        WHERE analyzed_content IS NOT NULL 
        AND analyzed_content != 'null'::jsonb
        AND (caption_data IS NULL OR caption_data = '')
    )
    UPDATE public.messages m
    SET caption_data = tu.analyzed_content::text
    FROM to_update tu
    WHERE m.id = tu.id;
    
    GET DIAGNOSTICS updated_count2 = ROW_COUNT;
    updated_count := updated_count + updated_count2;
    
    RETURN updated_count;
END;
$$;

-- Function to reset stalled processing messages
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages(p_older_than_minutes integer DEFAULT 30, p_correlation_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reset_count INTEGER;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff time
  v_cutoff_time := NOW() - (p_older_than_minutes * INTERVAL '1 minute');
  
  -- Reset stalled messages in 'processing' state
  WITH reset_messages AS (
    UPDATE messages
    SET
      processing_state = 'pending',
      updated_at = NOW(),
      retry_count = COALESCE(retry_count, 0) + 1,
      last_error_at = NOW()
    WHERE 
      processing_state = 'processing'
      AND updated_at < v_cutoff_time
    RETURNING id
  )
  SELECT COUNT(*) INTO v_reset_count FROM reset_messages;
  
  -- Log the reset operation
  PERFORM xdelo_log_event(
    'stalled_messages_reset',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'reset_count', v_reset_count,
      'cutoff_time', v_cutoff_time,
      'older_than_minutes', p_older_than_minutes
    ),
    p_correlation_id
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'reset_count', v_reset_count,
    'cutoff_time', v_cutoff_time
  );
END;
$$;

-- Function to set message processing state
CREATE OR REPLACE FUNCTION public.xdelo_set_message_processing(p_message_id uuid, p_correlation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET 
    processing_state = 'processing',
    processing_started_at = NOW(),
    correlation_id = p_correlation_id
  WHERE id = p_message_id;
  
  -- Log the processing start
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata
  ) VALUES (
    'message_processing_started',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'processor', 'caption-processor',
      'start_time', NOW()
    )
  );
END;
$$;

-- Function to mark message as complete
CREATE OR REPLACE FUNCTION public.xdelo_mark_message_complete(p_message_id uuid, p_correlation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET 
    processing_state = 'completed',
    processing_completed_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the processing completion
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata
  ) VALUES (
    'message_processing_completed',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'completion_time', NOW()
    )
  );
END;
$$;

-- Function to handle message processing error
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_error(p_message_id uuid, p_error_message text, p_correlation_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET 
    processing_state = 'error',
    error_message = p_error_message,
    last_error_at = NOW(),
    retry_count = COALESCE(retry_count, 0) + 1
  WHERE id = p_message_id;
  
  -- Log the error
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    error_message
  ) VALUES (
    'message_processing_error',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'error_time', NOW()
    ),
    p_error_message
  );
END;
$$;

-- Function to sync content across a media group
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(p_source_message_id uuid, p_media_group_id text, p_correlation_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_message record;
  v_updated_count integer := 0;
  v_skipped_count integer := 0;
  v_total_count integer := 0;
BEGIN
  -- Get source message details
  SELECT 
    id, 
    caption, 
    analyzed_content
  INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id;
  
  -- If source message not found or lacks required data
  IF v_source_message IS NULL OR v_source_message.caption IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Source message not found or has no caption',
      'source_id', p_source_message_id
    );
  END IF;
  
  -- Count total messages in group
  SELECT COUNT(*) INTO v_total_count
  FROM messages
  WHERE media_group_id = p_media_group_id;
  
  -- Update all other messages in the group
  WITH updated AS (
    UPDATE messages
    SET 
      caption = v_source_message.caption,
      analyzed_content = v_source_message.analyzed_content,
      group_caption_synced = TRUE,
      is_original_caption = FALSE,
      updated_at = NOW()
    WHERE 
      media_group_id = p_media_group_id
      AND id != p_source_message_id
      AND (
        caption IS DISTINCT FROM v_source_message.caption OR
        analyzed_content IS DISTINCT FROM v_source_message.analyzed_content OR
        group_caption_synced = FALSE
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;
  
  -- Mark source message as original
  UPDATE messages
  SET
    is_original_caption = TRUE,
    group_caption_synced = TRUE
  WHERE id = p_source_message_id
  AND (is_original_caption = FALSE OR group_caption_synced = FALSE);
  
  v_skipped_count := v_total_count - v_updated_count - 1; -- -1 for source message
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata
  ) VALUES (
    'media_group_synced',
    p_source_message_id,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'updated_count', v_updated_count,
      'skipped_count', v_skipped_count,
      'total_in_group', v_total_count
    )
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id,
    'updated_count', v_updated_count,
    'skipped_count', v_skipped_count,
    'total_in_group', v_total_count
  );
END;
$$;
