-- Update the media group check function to handle correlation_id properly
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_content(
  p_media_group_id text, 
  p_message_id uuid,
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_analyzed_content JSONB;
  v_caption_message_id UUID;
  v_result JSONB;
  v_message_has_caption BOOLEAN;
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
  SELECT (caption IS NOT NULL AND caption != '') INTO v_message_has_caption
  FROM messages
  WHERE id = p_message_id;
  
  -- If this message has a caption, it should be processed normally rather than synced
  IF v_message_has_caption THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'message_has_caption',
      'message_id', p_message_id,
      'should_analyze', true
    );
  END IF;
  
  -- Find any message in the group with analyzed content
  SELECT 
    m.id, 
    m.analyzed_content 
  INTO 
    v_caption_message_id, 
    v_analyzed_content
  FROM 
    messages m
  WHERE 
    m.media_group_id = p_media_group_id
    AND m.analyzed_content IS NOT NULL
    AND m.id != p_message_id
  ORDER BY 
    m.is_original_caption DESC,  -- Prefer original caption holders
    m.created_at ASC             -- Otherwise use the earliest message
  LIMIT 1;
  
  -- No analyzed content found in the group
  IF v_caption_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_analyzed_content_in_group',
      'message_id', p_message_id
    );
  END IF;
  
  -- Update the current message with the found content
  UPDATE messages
  SET 
    analyzed_content = v_analyzed_content,
    message_caption_id = v_caption_message_id,
    is_original_caption = false,
    group_caption_synced = true,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE 
    id = p_message_id;
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type, 
    entity_id, 
    metadata,
    event_timestamp,
    correlation_id
  ) VALUES (
    'media_group_content_synced',
    p_message_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'source_message_id', v_caption_message_id,
      'operation', 'check_and_sync'
    ),
    NOW(),
    p_correlation_id
  );
  
  -- Build result
  RETURN jsonb_build_object(
    'success', true,
    'analyzed_content', v_analyzed_content,
    'source_message_id', v_caption_message_id
  );
END;
$function$;

-- Create improved media group sync function with atomic operations and better error handling
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
  p_source_message_id uuid, 
  p_media_group_id text, 
  p_correlation_id text DEFAULT NULL,
  p_force_sync boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_source_message messages;
  v_result JSONB;
  v_updated_count INTEGER := 0;
  v_error TEXT;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Acquire advisory lock on media group to prevent concurrent syncs
  -- We use hashtext to convert the media_group_id string to a bigint
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext(p_media_group_id));
  
  IF NOT v_lock_acquired THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Could not acquire lock on media group, another sync operation is in progress',
      'media_group_id', p_media_group_id
    );
  END IF;

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
  
  -- Update all other messages in the group with the analyzed content - BATCH UPDATE
  WITH updated_messages AS (
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
      AND id != p_source_message_id
      AND (p_force_sync = true OR group_caption_synced = false OR analyzed_content IS NULL)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated_messages;
  
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
      'operation', 'sync_group',
      'force_sync', p_force_sync
    ),
    p_correlation_id,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id, 
    'updated_count', v_updated_count,
    'correlation_id', p_correlation_id,
    'force_sync', p_force_sync
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
        'operation', 'sync_group',
        'force_sync', p_force_sync
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
$function$;

-- Add index to improve performance on media_group_id lookups and syncing
CREATE INDEX IF NOT EXISTS idx_messages_media_group_sync ON messages (media_group_id, group_caption_synced, is_original_caption);

-- Create function to find suitable caption message in a media group
CREATE OR REPLACE FUNCTION public.xdelo_find_caption_message(p_media_group_id text)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_message_id uuid;
BEGIN
  -- First try to find a message that already has caption and analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
    AND analyzed_content IS NOT NULL
    AND is_original_caption = true
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- If not found, try to find a message with caption but no analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- If still not found, return NULL
  RETURN NULL;
END;
$function$;

-- Create a repair function for media groups with broken sync
CREATE OR REPLACE FUNCTION public.xdelo_repair_media_group_syncs()
RETURNS TABLE(media_group_id text, source_message_id uuid, updated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_group record;
  v_source_message_id uuid;
  v_result jsonb;
BEGIN
  -- Find media groups that have sync issues
  FOR v_group IN 
    SELECT 
      mg.media_group_id
    FROM (
      SELECT 
        media_group_id,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE analyzed_content IS NULL) as missing_content_count,
        COUNT(*) FILTER (WHERE group_caption_synced = false) as unsynced_count
      FROM 
        messages
      WHERE 
        media_group_id IS NOT NULL
        AND deleted_from_telegram = false
      GROUP BY 
        media_group_id
    ) mg
    WHERE 
      mg.missing_content_count > 0
      OR mg.unsynced_count > 0
    LIMIT 100
  LOOP
    -- Find a suitable caption message
    v_source_message_id := xdelo_find_caption_message(v_group.media_group_id);
    
    IF v_source_message_id IS NOT NULL THEN
      -- Sync the group using our new function
      v_result := xdelo_sync_media_group_content(
        v_source_message_id,
        v_group.media_group_id,
        'repair_' || gen_random_uuid()::text,
        true
      );
      
      IF (v_result->>'success')::boolean THEN
        media_group_id := v_group.media_group_id;
        source_message_id := v_source_message_id;
        updated_count := (v_result->>'updated_count')::integer;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
END;
$function$;
