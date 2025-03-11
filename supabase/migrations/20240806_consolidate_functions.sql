
-- Start transaction
BEGIN;

-- 1. Drop redundant or deprecated functions and triggers that will be replaced
DROP FUNCTION IF EXISTS public.xdelo_trigger_caption_analysis();
DROP FUNCTION IF EXISTS public.xdelo_analyze_message_caption(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.xdelo_handle_message_update_legacy(jsonb);
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_history(text, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.xdelo_process_pending_messages_legacy(integer);
DROP FUNCTION IF EXISTS public.xdelo_get_message_for_analysis(uuid);
DROP FUNCTION IF EXISTS public.tg_get_next_messages(integer);
DROP FUNCTION IF EXISTS public.tg_complete_processing(uuid, jsonb);
DROP FUNCTION IF EXISTS public.tg_fail_processing(uuid, text);

-- 2. Recreate and consolidate media group sync function with improved error handling
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
    'media_group_synced_direct',
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

-- 3. Consolidate message processing state functions
CREATE OR REPLACE FUNCTION public.xdelo_get_message_processing_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending_count integer;
  v_processing_count integer;
  v_error_count integer;
  v_completed_count integer;
  v_total_messages integer;
  v_oldest_pending_age interval;
  v_oldest_processing_age interval;
  v_stalled_messages integer;
BEGIN
  -- Count by processing state
  SELECT COUNT(*) INTO v_pending_count
  FROM messages
  WHERE processing_state = 'pending'
    AND deleted_from_telegram = false;
    
  SELECT COUNT(*) INTO v_processing_count
  FROM messages
  WHERE processing_state = 'processing'
    AND deleted_from_telegram = false;
    
  SELECT COUNT(*) INTO v_error_count
  FROM messages
  WHERE processing_state = 'error'
    AND deleted_from_telegram = false;
    
  SELECT COUNT(*) INTO v_completed_count
  FROM messages
  WHERE processing_state = 'completed'
    AND deleted_from_telegram = false;
    
  SELECT COUNT(*) INTO v_total_messages
  FROM messages
  WHERE deleted_from_telegram = false;
  
  -- Get oldest pending message age
  SELECT NOW() - MIN(created_at) INTO v_oldest_pending_age
  FROM messages
  WHERE processing_state = 'pending'
    AND deleted_from_telegram = false;
    
  -- Get oldest processing message age
  SELECT NOW() - MIN(processing_started_at) INTO v_oldest_processing_age
  FROM messages
  WHERE processing_state = 'processing'
    AND deleted_from_telegram = false;
    
  -- Count stalled messages
  SELECT COUNT(*) INTO v_stalled_messages
  FROM messages
  WHERE processing_state = 'processing'
    AND processing_started_at < NOW() - INTERVAL '30 minutes'
    AND deleted_from_telegram = false;
    
  RETURN jsonb_build_object(
    'pending_count', v_pending_count,
    'processing_count', v_processing_count,
    'error_count', v_error_count,
    'completed_count', v_completed_count,
    'total_messages', v_total_messages,
    'oldest_pending_age', EXTRACT(EPOCH FROM v_oldest_pending_age),
    'oldest_processing_age', EXTRACT(EPOCH FROM v_oldest_processing_age),
    'stalled_messages', v_stalled_messages
  );
END;
$$;

-- 4. Enhance and consolidate the reset stalled messages function
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

-- 5. Enhance the check_media_group_content function to handle orphaned messages better
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

-- 6. Create a consolidated repair media group function
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

-- 7. Create a consolidated comprehensive repair function
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

-- 8. Create consistent cron jobs to perform maintenance
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
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-messages') THEN
    PERFORM cron.schedule(
      'process-pending-messages',
      '*/5 * * * *',  -- Every 5 minutes
      'SELECT xdelo_process_pending_messages(20);'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xdelo-hourly-maintenance') THEN
    PERFORM cron.schedule(
      'xdelo-hourly-maintenance',
      '5 * * * *',  -- 5 minutes past every hour
      'SELECT xdelo_reset_stalled_messages();'
    );
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xdelo-daily-maintenance') THEN
    PERFORM cron.schedule(
      'xdelo-daily-maintenance',
      '0 3 * * *',  -- 3 AM daily
      'SELECT xdelo_repair_all_processing_systems();'
    );
  END IF;
END
$$;

COMMIT;
