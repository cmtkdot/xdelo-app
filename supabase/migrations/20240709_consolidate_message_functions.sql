
-- Drop redundant/legacy media group sync functions
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_history;
DROP FUNCTION IF EXISTS public.xdelo_sync_pending_media_group_messages;

-- Create improved media group repair function with better error handling
CREATE OR REPLACE FUNCTION public.xdelo_repair_message_processing_states(
  p_reset_all boolean DEFAULT false,
  p_correlation_id text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_reset_stalled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
  v_reset_count integer := 0;
  v_stalled_count integer := 0;
  v_error_count integer := 0;
  v_non_media_count integer := 0;
BEGIN
  -- Generate a correlation ID if not provided
  IF p_correlation_id IS NULL THEN
    p_correlation_id := gen_random_uuid()::text;
  END IF;
  
  -- STEP 1: Reset messages in 'error' state
  IF p_reset_all THEN
    UPDATE messages
    SET 
      processing_state = 'pending',
      error_message = NULL,
      updated_at = NOW()
    WHERE 
      processing_state = 'error'
      AND deleted_from_telegram = false
    RETURNING id INTO v_result;
    
    GET DIAGNOSTICS v_error_count = ROW_COUNT;
  END IF;
  
  -- STEP 2: Reset stalled messages that have been 'processing' for too long
  IF p_reset_stalled THEN
    UPDATE messages
    SET 
      processing_state = 'pending',
      error_message = 'Reset from stalled processing state',
      updated_at = NOW()
    WHERE 
      processing_state = 'processing'
      AND deleted_from_telegram = false
      AND (
        processing_started_at < NOW() - INTERVAL '1 hour'
        OR processing_started_at IS NULL
      )
    LIMIT p_limit;
    
    GET DIAGNOSTICS v_stalled_count = ROW_COUNT;
  END IF;
  
  -- STEP 3: Fix non-media messages with incorrect processing state
  UPDATE other_messages
  SET 
    processing_state = 'completed',
    processing_completed_at = COALESCE(processing_completed_at, NOW()),
    updated_at = NOW()
  WHERE 
    processing_state != 'completed'
    AND message_type NOT IN ('caption', 'photo', 'video');
    
  GET DIAGNOSTICS v_non_media_count = ROW_COUNT;
  
  -- STEP 4: Handle media group sync issues by finding messages with captions but not marked properly
  WITH caption_messages AS (
    SELECT 
      m.id,
      m.media_group_id
    FROM 
      messages m
    WHERE 
      m.caption IS NOT NULL
      AND m.caption != ''
      AND m.media_group_id IS NOT NULL
      AND (m.is_original_caption = false OR m.is_original_caption IS NULL)
      AND m.deleted_from_telegram = false
      AND m.analyzed_content IS NOT NULL
    LIMIT p_limit
  )
  UPDATE messages m
  SET 
    is_original_caption = true,
    group_caption_synced = false,
    updated_at = NOW()
  FROM caption_messages cm
  WHERE m.id = cm.id;
  
  -- Build result object
  v_reset_count := v_error_count + v_stalled_count;
  
  v_result := jsonb_build_object(
    'success', true,
    'correlation_id', p_correlation_id,
    'reset_count', v_reset_count,
    'stalled_reset', v_stalled_count,
    'error_reset', v_error_count,
    'non_media_fixed', v_non_media_count
  );
  
  -- Log the repair operation
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_processing_states_repaired',
    p_correlation_id,
    v_result,
    NOW()
  );
  
  RETURN v_result;
EXCEPTION 
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'correlation_id', p_correlation_id
    );
END;
$function$;

-- Consolidated enum type maintenance function
CREATE OR REPLACE FUNCTION public.xdelo_ensure_event_types_exist()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check and add new event types to the processing_state_type enum
  BEGIN
    ALTER TYPE processing_state_type ADD VALUE IF NOT EXISTS 'no_caption';
  EXCEPTION WHEN duplicate_object THEN
    -- Type already exists, ignore
  END;
  
  -- Check and add event types to the unified_audit_log_event_type enum
  DECLARE
    v_event_types text[] := ARRAY[
      'message_created',
      'message_updated',
      'processing_state_changed',
      'media_group_synced',
      'media_group_synced_fallback',
      'media_group_sync_error',
      'message_processing_started',
      'message_processing_completed',
      'message_processing_error',
      'caption_analysis_error',
      'media_group_content_synced',
      'message_content_updated',
      'storage_validation_completed',
      'storage_paths_repaired',
      'processing_flow_repaired',
      'redownload_requested',
      'message_processing_states_repaired',
      'media_group_synced_direct'
    ];
    v_type text;
  BEGIN
    FOREACH v_type IN ARRAY v_event_types LOOP
      BEGIN
        -- Try to add the value if it doesn't exist
        EXECUTE format('ALTER TYPE unified_audit_log_event_type ADD VALUE IF NOT EXISTS %L', v_type);
      EXCEPTION WHEN duplicate_object THEN
        -- Value already exists, continue to next one
      END;
    END LOOP;
  END;
END;
$function$;

-- Fix database inconsistencies (message relationships)
CREATE OR REPLACE FUNCTION public.xdelo_repair_message_relationships()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
  v_fixed_refs integer := 0;
  v_fixed_captions integer := 0;
BEGIN
  -- Update any messages referencing non-existent message_caption_id
  WITH orphaned_refs AS (
    SELECT 
      m.id
    FROM 
      messages m
    WHERE 
      m.message_caption_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM messages src
        WHERE src.id = m.message_caption_id
      )
  )
  UPDATE messages m
  SET 
    message_caption_id = NULL,
    is_original_caption = false,
    group_caption_synced = false,
    updated_at = NOW()
  FROM orphaned_refs o
  WHERE m.id = o.id;
  
  GET DIAGNOSTICS v_fixed_refs = ROW_COUNT;
  
  -- Identify and fix media groups with multiple messages claiming to be original caption
  WITH media_groups_with_multiple_originals AS (
    SELECT 
      media_group_id,
      array_agg(id) as message_ids,
      count(*) as original_count
    FROM 
      messages
    WHERE 
      is_original_caption = true
      AND media_group_id IS NOT NULL
    GROUP BY 
      media_group_id
    HAVING 
      count(*) > 1
  ),
  best_caption_messages AS (
    SELECT 
      mg.media_group_id,
      (
        SELECT id FROM messages m
        WHERE 
          m.media_group_id = mg.media_group_id
          AND m.is_original_caption = true
          AND m.caption IS NOT NULL
        ORDER BY 
          m.caption != '' DESC,
          m.analyzed_content IS NOT NULL DESC,
          m.created_at ASC
        LIMIT 1
      ) as best_caption_id
    FROM media_groups_with_multiple_originals mg
  )
  UPDATE messages m
  SET 
    is_original_caption = false,
    updated_at = NOW()
  FROM best_caption_messages bcm
  WHERE 
    m.media_group_id = bcm.media_group_id
    AND m.is_original_caption = true
    AND m.id != bcm.best_caption_id;
  
  GET DIAGNOSTICS v_fixed_captions = ROW_COUNT;
  
  -- Build result object
  v_result := jsonb_build_object(
    'success', true,
    'fixed_references', v_fixed_refs,
    'fixed_captions', v_fixed_captions
  );
  
  RETURN v_result;
EXCEPTION 
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- Consolidated diagnostic function
CREATE OR REPLACE FUNCTION public.xdelo_diagnose_queue_issues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Check for messages stuck in processing state
  WITH stuck_processing AS (
    SELECT 
      count(*) as count,
      max(now() - processing_started_at) as max_duration
    FROM 
      messages
    WHERE 
      processing_state = 'processing'
      AND processing_started_at < now() - interval '30 minutes'
  ),
  
  -- Check for messages with captions but no analyzed content
  unprocessed_captions AS (
    SELECT 
      count(*) as count
    FROM 
      messages
    WHERE 
      caption IS NOT NULL
      AND caption != ''
      AND analyzed_content IS NULL
      AND deleted_from_telegram = false
  ),
  
  -- Check for media group sync issues
  media_group_issues AS (
    SELECT 
      count(DISTINCT media_group_id) as groups_with_issues
    FROM 
      messages
    WHERE 
      media_group_id IS NOT NULL
      AND group_caption_synced = false
      AND deleted_from_telegram = false
  ),
  
  -- Check for processing queue
  queue_status AS (
    SELECT 
      status,
      count(*) as count
    FROM 
      message_processing_queue
    GROUP BY 
      status
  )
  
  SELECT 
    jsonb_build_object(
      'status', 'success',
      'stuck_processing', (SELECT jsonb_build_object('count', count, 'max_duration', max_duration) FROM stuck_processing),
      'unprocessed_captions', (SELECT jsonb_build_object('count', count) FROM unprocessed_captions),
      'media_group_issues', (SELECT jsonb_build_object('count', groups_with_issues) FROM media_group_issues),
      'queue_status', (SELECT jsonb_object_agg(status, count) FROM queue_status),
      'timestamp', now()
    ) INTO v_result;
  
  RETURN v_result;
EXCEPTION 
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', SQLERRM,
      'timestamp', now()
    );
END;
$function$;
