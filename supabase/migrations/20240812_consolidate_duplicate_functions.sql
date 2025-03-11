
-- Start transaction
BEGIN;

-- 1. Drop all duplicate functions that will be replaced with consolidated versions
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_history;
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content;
DROP FUNCTION IF EXISTS public.xdelo_reset_stalled_messages;
DROP FUNCTION IF EXISTS public.xdelo_update_message_with_analyzed_content;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_update;
DROP FUNCTION IF EXISTS public.xdelo_commit_transaction_with_sync;

-- 2. Create consolidated media group sync function with improved error handling and advisory locks
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

-- 3. Consolidated function to reset stalled messages with improved metadata
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages(
  p_time_threshold interval DEFAULT INTERVAL '30 minutes',
  p_limit integer DEFAULT 50
)
RETURNS TABLE(message_id uuid, previous_state text, reset_reason text, processing_time interval)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    UPDATE messages m
    SET
      processing_state = 'pending',
      processing_attempts = COALESCE(processing_attempts, 0) + 1,
      last_processing_attempt = NOW(),
      error_message = CASE 
        WHEN m.processing_state = 'processing' THEN 'Reset due to stalled processing'
        WHEN m.processing_state = 'pending' AND m.updated_at < NOW() - p_time_threshold THEN 'Reset due to stuck pending state'
        ELSE 'Reset from ' || m.processing_state || ' state'
      END,
      retry_count = COALESCE(retry_count, 0) + 1,
      updated_at = NOW()
    WHERE
      (
        (m.processing_state = 'processing' AND m.processing_started_at < NOW() - p_time_threshold)
        OR (m.processing_state = 'pending' AND m.updated_at < NOW() - p_time_threshold)
        OR (m.processing_state = 'error' AND m.last_error_at < NOW() - INTERVAL '24 hours')
      )
      AND m.caption IS NOT NULL 
      AND m.caption != '' 
      AND m.analyzed_content IS NULL
      AND m.deleted_from_telegram = false
    LIMIT p_limit
    RETURNING 
      m.id,
      m.processing_state,
      CASE 
        WHEN m.processing_state = 'processing' THEN 'stalled_processing' 
        WHEN m.processing_state = 'pending' THEN 'stuck_pending'
        ELSE 'error_state'
      END as reason,
      NOW() - COALESCE(m.processing_started_at, m.updated_at, m.last_error_at) as processing_time
  )
  SELECT u.id, u.processing_state, u.reason, u.processing_time
  FROM updates u;
  
  -- Log the reset operation
  INSERT INTO unified_audit_logs (
    event_type,
    metadata,
    event_timestamp
  ) VALUES (
    'system_reset_stalled_messages',
    jsonb_build_object(
      'reset_count', (SELECT COUNT(*) FROM updates),
      'threshold_minutes', EXTRACT(EPOCH FROM p_time_threshold) / 60,
      'timestamp', NOW()
    ),
    NOW()
  );
END;
$$;

-- 4. Consolidated function to update message with analyzed content with transaction support
CREATE OR REPLACE FUNCTION public.xdelo_update_message_with_analyzed_content(
  p_message_id uuid,
  p_analyzed_content jsonb,
  p_correlation_id text DEFAULT NULL,
  p_force_sync boolean DEFAULT true,
  p_sync_edit_history boolean DEFAULT false,
  p_is_edit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_media_group_id text;
  v_old_analyzed_content jsonb[];
  v_edit_history jsonb[];
  v_sync_result jsonb;
BEGIN
  -- Get message data with row lock to prevent concurrent updates
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;
  
  -- Store current values for history tracking
  v_media_group_id := v_message.media_group_id;
  
  -- Prepare edit history if needed
  IF p_is_edit AND v_message.analyzed_content IS NOT NULL THEN
    -- Get existing old_analyzed_content array
    v_old_analyzed_content := COALESCE(v_message.old_analyzed_content, ARRAY[]::jsonb[]);
    
    -- Add current content to history
    v_old_analyzed_content := array_append(
      v_old_analyzed_content, 
      jsonb_build_object(
        'content', v_message.analyzed_content,
        'archived_timestamp', NOW(),
        'archived_reason', 'edit'
      )
    );
    
    -- Update edit history
    v_edit_history := COALESCE(v_message.edit_history, ARRAY[]::jsonb[]);
    v_edit_history := array_append(
      v_edit_history,
      jsonb_build_object(
        'timestamp', NOW(),
        'type', 'edit',
        'previous_analyzed_content', v_message.analyzed_content
      )
    );
  END IF;
  
  -- Update the message
  UPDATE messages
  SET 
    analyzed_content = p_analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
    group_caption_synced = CASE WHEN v_media_group_id IS NOT NULL THEN false ELSE group_caption_synced END,
    old_analyzed_content = CASE WHEN p_is_edit THEN v_old_analyzed_content ELSE old_analyzed_content END,
    edit_history = CASE WHEN p_is_edit THEN v_edit_history ELSE edit_history END,
    edit_count = CASE WHEN p_is_edit THEN COALESCE(edit_count, 0) + 1 ELSE edit_count END,
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
      'is_edit', p_is_edit,
      'operation', 'update_analyzed_content'
    ),
    NOW()
  );
  
  -- Sync with media group if applicable
  IF v_media_group_id IS NOT NULL AND p_force_sync THEN
    v_sync_result := xdelo_sync_media_group_content(
      p_message_id,
      v_media_group_id,
      p_correlation_id,
      true, -- Force sync
      p_sync_edit_history -- Sync edit history if requested
    );
  ELSE
    v_sync_result := jsonb_build_object(
      'success', true,
      'message', 'Message updated, no media group sync performed',
      'message_id', p_message_id,
      'skipped_sync', true
    );
  END IF;
  
  RETURN v_sync_result;
END;
$$;

-- 5. Create a consolidated function to handle message updates from webhooks
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update(p_message jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id text := gen_random_uuid()::text;
  v_message_id uuid;
  v_media_group_id text;
  v_caption text;
  v_result jsonb;
  v_processing_state text;
BEGIN
  -- Extract important fields from the message
  v_message_id := (p_message->>'id')::uuid;
  v_media_group_id := p_message->>'media_group_id';
  v_caption := p_message->>'caption';
  
  -- Determine processing state based on message content
  v_processing_state := CASE
    WHEN v_caption IS NULL OR v_caption = '' THEN 'pending'
    ELSE 'initialized'
  END;
  
  -- Check if message exists
  IF EXISTS (SELECT 1 FROM messages WHERE id = v_message_id) THEN
    -- Update existing message
    UPDATE messages
    SET
      caption = v_caption,
      media_group_id = v_media_group_id,
      updated_at = NOW(),
      correlation_id = v_correlation_id,
      processing_state = CASE
        WHEN analyzed_content IS NOT NULL THEN 'completed'
        ELSE v_processing_state
      END
    WHERE id = v_message_id
    RETURNING id INTO v_message_id;
    
    -- Log the update
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      event_timestamp
    ) VALUES (
      'message_updated',
      v_message_id,
      v_correlation_id,
      jsonb_build_object(
        'updated_fields', jsonb_build_object(
          'caption', v_caption IS NOT NULL,
          'media_group_id', v_media_group_id IS NOT NULL
        ),
        'media_group_id', v_media_group_id
      ),
      NOW()
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Message updated',
      'message_id', v_message_id,
      'correlation_id', v_correlation_id
    );
  ELSE
    -- Insert new message
    INSERT INTO messages (
      id,
      caption,
      media_group_id,
      correlation_id,
      processing_state,
      created_at,
      updated_at
    ) VALUES (
      v_message_id,
      v_caption,
      v_media_group_id,
      v_correlation_id,
      v_processing_state,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_message_id;
    
    -- Log the creation
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      event_timestamp
    ) VALUES (
      'message_created',
      v_message_id,
      v_correlation_id,
      jsonb_build_object(
        'has_caption', v_caption IS NOT NULL,
        'media_group_id', v_media_group_id,
        'processing_state', v_processing_state
      ),
      NOW()
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Message created',
      'message_id', v_message_id,
      'correlation_id', v_correlation_id
    );
  END IF;
  
  -- If message is part of a media group, check if it can inherit content
  IF v_media_group_id IS NOT NULL AND v_caption IS NULL THEN
    PERFORM xdelo_check_media_group_content(
      v_media_group_id,
      v_message_id,
      v_correlation_id
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- 6. Create consolidated function for transaction handling with commit and media group sync
CREATE OR REPLACE FUNCTION public.xdelo_begin_transaction()
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

CREATE OR REPLACE FUNCTION public.xdelo_commit_transaction_with_sync(
  p_message_id uuid, 
  p_media_group_id text, 
  p_correlation_id text,
  p_force_sync boolean DEFAULT true,
  p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- If message has a media group ID, sync with group
  IF p_media_group_id IS NOT NULL AND p_force_sync THEN
    SELECT * INTO v_result
    FROM xdelo_sync_media_group_content(
      p_message_id,
      p_media_group_id,
      p_correlation_id,
      true, -- Force sync
      p_sync_edit_history  -- Sync edit history if requested
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

-- 7. Create function to check if a message can inherit analyzed content from its media group
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_content(
  p_media_group_id text, 
  p_message_id uuid, 
  p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_has_caption boolean;
  v_analyzed_message_id uuid;
  v_analyzed_content jsonb;
  v_target_updated boolean := false;
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
  SELECT caption IS NOT NULL AND caption != '' INTO v_message_has_caption
  FROM messages 
  WHERE id = p_message_id;
  
  IF v_message_has_caption THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'message_has_caption',
      'message_id', p_message_id,
      'should_analyze', true
    );
  END IF;
  
  -- Find any message in the group with analyzed content
  SELECT id, analyzed_content INTO v_analyzed_message_id, v_analyzed_content
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND analyzed_content IS NOT NULL
    AND id != p_message_id
    AND deleted_from_telegram = false
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF FOUND THEN
    -- Update the target message with the analyzed content
    UPDATE messages
    SET 
      analyzed_content = v_analyzed_content,
      message_caption_id = v_analyzed_message_id,
      is_original_caption = false,
      group_caption_synced = true,
      processing_state = 'completed',
      processing_completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_message_id;
    
    GET DIAGNOSTICS v_target_updated = ROW_COUNT;
    
    IF v_target_updated THEN
      -- Log the sync operation
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        correlation_id,
        event_timestamp
      ) VALUES (
        'media_group_content_synced',
        p_message_id,
        jsonb_build_object(
          'media_group_id', p_media_group_id,
          'source_message_id', v_analyzed_message_id,
          'operation', 'check_and_sync'
        ),
        p_correlation_id,
        NOW()
      );
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Content synced from media group',
        'source_message_id', v_analyzed_message_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'reason', 'no_analyzed_content_in_group'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'error',
      'error', SQLERRM
    );
END;
$$;

-- 8. Create function to repair orphaned media group messages
CREATE OR REPLACE FUNCTION public.xdelo_repair_orphaned_media_group_messages(
  p_limit integer DEFAULT 50
)
RETURNS TABLE(message_id uuid, media_group_id text, synced boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_media_group record;
  v_message record;
  v_sync_result jsonb;
  v_correlation_id text := gen_random_uuid()::text;
BEGIN
  -- Find media groups with at least one analyzed message and at least one pending/error message
  FOR v_media_group IN 
    SELECT DISTINCT mg.media_group_id
    FROM (
      SELECT 
        media_group_id,
        COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) AS analyzed_count,
        COUNT(*) FILTER (WHERE processing_state IN ('pending', 'error', 'processing') AND analyzed_content IS NULL) AS unprocessed_count
      FROM messages
      WHERE 
        media_group_id IS NOT NULL 
        AND deleted_from_telegram = false
      GROUP BY media_group_id
    ) mg
    WHERE 
      mg.analyzed_count > 0 
      AND mg.unprocessed_count > 0
    LIMIT p_limit
  LOOP
    -- For each media group, find the best message with analyzed content to be the source
    SELECT id INTO v_message.source_id
    FROM messages
    WHERE 
      media_group_id = v_media_group.media_group_id
      AND analyzed_content IS NOT NULL
      AND deleted_from_telegram = false
    ORDER BY 
      is_original_caption DESC,
      created_at ASC
    LIMIT 1;
    
    -- For each media group, find unprocessed messages
    FOR v_message IN
      SELECT id
      FROM messages
      WHERE 
        media_group_id = v_media_group.media_group_id
        AND analyzed_content IS NULL
        AND processing_state IN ('pending', 'error', 'processing')
        AND deleted_from_telegram = false
      LIMIT 20
    LOOP
      -- Try to sync this message from the source
      v_sync_result := xdelo_check_media_group_content(
        v_media_group.media_group_id, 
        v_message.id,
        v_correlation_id
      );
      
      message_id := v_message.id;
      media_group_id := v_media_group.media_group_id;
      synced := (v_sync_result->>'success')::boolean;
      
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- Log the repair attempt
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'orphaned_media_groups_repaired',
    v_correlation_id,
    jsonb_build_object(
      'repair_attempted', FOUND,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN;
END;
$$;

-- 9. Comprehensive repair function that fixes multiple issues
CREATE OR REPLACE FUNCTION public.xdelo_repair_all_processing_systems(
  p_repair_stalled boolean DEFAULT true,
  p_repair_media_groups boolean DEFAULT true,
  p_repair_relationships boolean DEFAULT true,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id text := gen_random_uuid()::text;
  v_stalled_count integer := 0;
  v_media_group_count integer := 0;
  v_relationship_count integer := 0;
  v_result record;
BEGIN
  -- Reset stalled messages
  IF p_repair_stalled THEN
    FOR v_result IN SELECT * FROM xdelo_reset_stalled_messages(INTERVAL '30 minutes', p_limit) LOOP
      v_stalled_count := v_stalled_count + 1;
    END LOOP;
  END IF;
  
  -- Repair media groups
  IF p_repair_media_groups THEN
    FOR v_result IN SELECT * FROM xdelo_repair_orphaned_media_group_messages(p_limit) LOOP
      IF v_result.synced THEN
        v_media_group_count := v_media_group_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Repair message relationships
  IF p_repair_relationships THEN
    DECLARE
      v_relationship_result jsonb;
    BEGIN
      v_relationship_result := xdelo_repair_message_relationships();
      v_relationship_count := (v_relationship_result->>'fixed_references')::integer + 
                              (v_relationship_result->>'fixed_captions')::integer;
    END;
  END IF;
  
  -- Log the repair operation
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'processing_system_repaired',
    v_correlation_id,
    jsonb_build_object(
      'stalled_reset', v_stalled_count,
      'media_groups_fixed', v_media_group_count,
      'relationships_fixed', v_relationship_count,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'correlation_id', v_correlation_id,
    'stalled_reset', v_stalled_count,
    'media_groups_fixed', v_media_group_count,
    'relationships_fixed', v_relationship_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'correlation_id', v_correlation_id
    );
END;
$$;

-- 10. Create a trigger to ensure all messages with captions get properly processed
CREATE OR REPLACE FUNCTION public.xdelo_process_pending_messages(
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  message_id uuid,
  caption text,
  media_group_id text,
  processed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message record;
  v_sync_result jsonb;
  v_processed boolean;
  v_correlation_id text := gen_random_uuid()::text;
BEGIN
  -- Find pending messages with captions
  FOR v_message IN
    SELECT 
      id, 
      caption, 
      media_group_id
    FROM messages
    WHERE 
      processing_state = 'pending'
      AND caption IS NOT NULL 
      AND caption != ''
      AND analyzed_content IS NULL
      AND deleted_from_telegram = false
    ORDER BY updated_at ASC
    LIMIT p_limit
  LOOP
    BEGIN
      -- First try to sync from media group if applicable
      IF v_message.media_group_id IS NOT NULL THEN
        v_sync_result := xdelo_check_media_group_content(
          v_message.media_group_id,
          v_message.id,
          v_correlation_id
        );
        
        -- If sync was successful, mark as processed
        IF (v_sync_result->>'success')::boolean THEN
          v_processed := true;
        ELSE
          -- If sync failed, try to process directly
          UPDATE messages
          SET 
            processing_state = 'processing',
            processing_started_at = NOW(),
            updated_at = NOW()
          WHERE id = v_message.id;
          
          -- Log the processing attempt
          INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            correlation_id,
            metadata,
            event_timestamp
          ) VALUES (
            'message_processing_started',
            v_message.id,
            v_correlation_id,
            jsonb_build_object(
              'caption_length', length(v_message.caption),
              'media_group_id', v_message.media_group_id,
              'trigger_source', 'scheduled_processor'
            ),
            NOW()
          );
          
          v_processed := true;
        END IF;
      ELSE
        -- Non-media group message, mark for direct processing
        UPDATE messages
        SET 
          processing_state = 'processing',
          processing_started_at = NOW(),
          updated_at = NOW()
        WHERE id = v_message.id;
        
        -- Log the processing attempt
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          correlation_id,
          metadata,
          event_timestamp
        ) VALUES (
          'message_processing_started',
          v_message.id,
          v_correlation_id,
          jsonb_build_object(
            'caption_length', length(v_message.caption),
            'trigger_source', 'scheduled_processor'
          ),
          NOW()
        );
        
        v_processed := true;
      END IF;
      
      -- Return the result
      message_id := v_message.id;
      caption := v_message.caption;
      media_group_id := v_message.media_group_id;
      processed := v_processed;
      
      RETURN NEXT;
    EXCEPTION 
      WHEN OTHERS THEN
        -- Log processing error
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          correlation_id,
          error_message,
          event_timestamp
        ) VALUES (
          'message_processing_error',
          v_message.id,
          v_correlation_id,
          SQLERRM,
          NOW()
        );
        
        -- Update message to error state
        UPDATE messages
        SET 
          processing_state = 'error',
          error_message = SQLERRM,
          last_error_at = NOW(),
          updated_at = NOW()
        WHERE id = v_message.id;
        
        -- Return the failed result
        message_id := v_message.id;
        caption := v_message.caption;
        media_group_id := v_message.media_group_id;
        processed := false;
        
        RETURN NEXT;
    END;
  END LOOP;
  
  RETURN;
END;
$$;

-- 11. Setup scheduled maintenance jobs with cron
DO $$
BEGIN
  -- First try to unschedule existing jobs
  BEGIN
    PERFORM cron.unschedule('process-pending-messages');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  BEGIN
    PERFORM cron.unschedule('xdelo-daily-maintenance');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  BEGIN
    PERFORM cron.unschedule('xdelo-hourly-maintenance');
  EXCEPTION WHEN OTHERS THEN
    -- Job doesn't exist, that's fine
  END;
  
  -- Create new jobs
  PERFORM cron.schedule(
    'process-pending-messages',
    '*/5 * * * *',  -- Every 5 minutes
    'SELECT xdelo_process_pending_messages(20);'
  );
  
  PERFORM cron.schedule(
    'xdelo-hourly-maintenance',
    '5 * * * *',  -- 5 minutes past every hour
    'SELECT xdelo_reset_stalled_messages();'
  );
  
  PERFORM cron.schedule(
    'xdelo-daily-maintenance',
    '0 3 * * *',  -- 3 AM daily
    'SELECT xdelo_repair_all_processing_systems();'
  );
END
$$;

-- 12. Update the documentation
INSERT INTO gl_documentation (
  name,
  module,
  description,
  created_at
) VALUES (
  'Consolidated Database Functions',
  'Database Functions',
  'This module provides consolidated functions for media group synchronization, message processing, and system maintenance after the cleanup process.',
  NOW()
) ON CONFLICT (name) DO UPDATE
SET 
  description = 'This module provides consolidated functions for media group synchronization, message processing, and system maintenance after the cleanup process.';

-- Commit transaction
COMMIT;

