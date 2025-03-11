
-- Improved function to reset stalled messages with better metadata tracking
CREATE OR REPLACE FUNCTION xdelo_reset_stalled_messages()
RETURNS TABLE(message_id uuid, previous_state text, reset_reason text, processing_time interval)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    UPDATE messages
    SET
      processing_state = 'pending',
      processing_attempts = COALESCE(processing_attempts, 0) + 1,
      last_processing_attempt = NOW(),
      error_message = CASE 
        WHEN processing_state = 'processing' THEN 'Reset due to stalled processing'
        WHEN processing_state = 'pending' THEN 'Reset due to stuck pending state'
        ELSE 'Reset from problematic state: ' || processing_state
      END,
      retry_count = COALESCE(retry_count, 0) + 1,
      updated_at = NOW()
    WHERE
      (
        (processing_state = 'processing' AND processing_started_at < NOW() - INTERVAL '30 minutes')
        OR (processing_state = 'pending' AND last_processing_attempt < NOW() - INTERVAL '60 minutes')
        OR (processing_state = 'error' AND last_error_at < NOW() - INTERVAL '24 hours')
      )
      AND caption IS NOT NULL 
      AND caption != '' 
      AND analyzed_content IS NULL
    RETURNING 
      id,
      processing_state,
      CASE 
        WHEN processing_state = 'processing' THEN 'stalled_processing' 
        WHEN processing_state = 'pending' THEN 'stuck_pending'
        ELSE 'error_state'
      END as reason,
      NOW() - COALESCE(processing_started_at, last_processing_attempt, last_error_at) as processing_time
  )
  SELECT message_id, previous_state, reset_reason, processing_time
  FROM updates;
  
  -- Log the reset operation
  INSERT INTO unified_audit_logs (
    event_type,
    metadata,
    event_timestamp
  ) VALUES (
    'system_reset_stalled_messages',
    jsonb_build_object(
      'reset_count', (SELECT COUNT(*) FROM updates),
      'timestamp', NOW()
    ),
    NOW()
  );
END;
$$;

-- Create a direct queue repair function that attempts to fix inconsistencies
CREATE OR REPLACE FUNCTION xdelo_repair_processing_flow(repair_limit int DEFAULT 50, repair_enums boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_processed_count int := 0;
  v_media_group_count int := 0;
  v_enum_errors jsonb;
  v_reset_count int := 0;
  v_correlation_id uuid := gen_random_uuid();
BEGIN
  -- First, repair any problematic messages stuck in processing
  WITH resets AS (
    SELECT * FROM xdelo_reset_stalled_messages() LIMIT repair_limit
  )
  SELECT COUNT(*) INTO v_reset_count FROM resets;
  
  -- Next, reset any orphaned queue entries
  UPDATE message_processing_queue
  SET 
    status = 'error',
    error_message = 'Reset due to orphaned state during repair',
    last_error_at = NOW()
  WHERE 
    status = 'processing' 
    AND processing_started_at < NOW() - INTERVAL '30 minutes';
  
  -- Perform media group sync for pending messages
  WITH fixed AS (
    SELECT * FROM xdelo_sync_pending_media_group_messages()
  )
  SELECT COALESCE(fixed.synced_count, 0) INTO v_media_group_count 
  FROM fixed;
  
  -- Optional: repair enum errors if requested
  IF repair_enums THEN
    BEGIN
      -- Try to add missing enum values
      EXECUTE '
        ALTER TYPE processing_state ADD VALUE IF NOT EXISTS ''initialized'';
        ALTER TYPE processing_state ADD VALUE IF NOT EXISTS ''pending'';
        ALTER TYPE processing_state ADD VALUE IF NOT EXISTS ''processing'';
        ALTER TYPE processing_state ADD VALUE IF NOT EXISTS ''completed'';
        ALTER TYPE processing_state ADD VALUE IF NOT EXISTS ''error'';
      ';
      
      -- Try to add missing audit log event types
      EXECUTE '
        ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''system_reset_stalled_messages'';
        ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''processing_flow_repair'';
        ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''direct_processing_error'';
        ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''message_processing_scheduled'';
      ';
      
      v_enum_errors := jsonb_build_object('success', true);
    EXCEPTION WHEN OTHERS THEN
      v_enum_errors := jsonb_build_object(
        'success', false,
        'error', SQLERRM
      );
    END;
  END IF;
  
  -- Log the repair attempt
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'processing_flow_repair',
    v_correlation_id,
    jsonb_build_object(
      'reset_count', v_reset_count,
      'media_group_synced', v_media_group_count,
      'enum_repair_attempted', repair_enums,
      'enum_repair_result', v_enum_errors
    ),
    NOW()
  );
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'processed', v_reset_count,
      'media_groups_fixed', v_media_group_count,
      'enum_repairs', v_enum_errors,
      'correlation_id', v_correlation_id
    )
  );
END;
$$;

-- Create a function to sync media group messages that are pending
CREATE OR REPLACE FUNCTION xdelo_sync_pending_media_group_messages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_media_group RECORD;
  v_message RECORD;
  v_sync_result JSONB;
BEGIN
  -- Find media groups that have at least one message with analyzed_content
  FOR v_media_group IN 
    SELECT DISTINCT mg.media_group_id
    FROM (
      SELECT 
        media_group_id,
        COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) AS analyzed_count,
        COUNT(*) FILTER (WHERE processing_state IN ('initialized', 'pending')) AS pending_count
      FROM messages
      WHERE 
        media_group_id IS NOT NULL 
        AND deleted_from_telegram = false
      GROUP BY media_group_id
    ) mg
    WHERE 
      mg.analyzed_count > 0 
      AND mg.pending_count > 0
    LIMIT 50
  LOOP
    -- For each qualified media group, find pending messages
    FOR v_message IN
      SELECT id, processing_state, caption
      FROM messages
      WHERE 
        media_group_id = v_media_group.media_group_id
        AND processing_state IN ('initialized', 'pending')
        AND deleted_from_telegram = false
      LIMIT 20
    LOOP
      -- Try to sync this message
      v_sync_result := xdelo_check_media_group_content(v_media_group.media_group_id, v_message.id);
      
      IF (v_sync_result->>'success')::BOOLEAN THEN
        v_synced_count := v_synced_count + 1;
      ELSE
        v_skipped_count := v_skipped_count + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN jsonb_build_object(
    'synced_count', v_synced_count,
    'skipped_count', v_skipped_count
  );
END;
$$;
