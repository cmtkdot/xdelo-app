
-- Start transaction
BEGIN;

-- First, drop any existing functions to avoid return type errors
DROP FUNCTION IF EXISTS public.xdelo_reset_stalled_messages();
DROP FUNCTION IF EXISTS public.xdelo_complete_message_processing(uuid, jsonb);

-- Create a properly typed function for resetting stalled messages
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages()
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
      'timestamp', NOW()
    ),
    NOW()
  );
END;
$$;

-- Create properly typed function for completing message processing
CREATE OR REPLACE FUNCTION public.xdelo_complete_message_processing(p_message_id uuid, p_analyzed_content jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_media_group_id text;
  v_correlation_id uuid;
BEGIN
  -- Get the message and important metadata
  SELECT 
    media_group_id, 
    processing_correlation_id
  INTO 
    v_media_group_id, 
    v_correlation_id
  FROM messages
  WHERE id = p_message_id;
  
  -- Update the message with analyzed content and mark as completed
  UPDATE messages
  SET 
    analyzed_content = p_analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
    group_caption_synced = true,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the completion
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_processing_completed',
    p_message_id,
    v_correlation_id::text,
    jsonb_build_object(
      'processor', 'direct-caption-processor',
      'completion_time', NOW(),
      'has_media_group', v_media_group_id IS NOT NULL
    ),
    NOW()
  );
  
  -- If the message is part of a media group, sync the content to other messages
  IF v_media_group_id IS NOT NULL THEN
    RETURN xdelo_sync_media_group_content(
      p_message_id,
      v_media_group_id,
      v_correlation_id::text,
      true -- Force sync
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Message processing completed',
      'message_id', p_message_id,
      'no_media_group', true
    );
  END IF;
END;
$$;

-- Recreate the scheduled processing function with fixed parameters
DROP FUNCTION IF EXISTS public.xdelo_run_scheduled_message_processing();

CREATE OR REPLACE FUNCTION public.xdelo_run_scheduled_message_processing()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time timestamptz := now();
  v_correlation_id uuid := gen_random_uuid();
  v_processed_count integer := 0;
  v_reset_count integer := 0;
  v_error text;
  v_result jsonb;
  v_processed_records record;
BEGIN
  -- Log the scheduled run start
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'scheduler_process_started',
    v_correlation_id,
    jsonb_build_object(
      'run_time', v_start_time,
      'type', 'scheduled_cron',
      'source', 'pg_cron'
    ),
    v_start_time
  );

  BEGIN
    -- Process pending messages and count them
    FOR v_processed_records IN SELECT * FROM xdelo_process_pending_messages(20) LOOP
      v_processed_count := v_processed_count + 1;
    END LOOP;
    
    -- Reset stalled messages and count them
    FOR v_processed_records IN SELECT * FROM xdelo_reset_stalled_messages() LOOP
      v_reset_count := v_reset_count + 1;
    END LOOP;
    
    -- Set successful result
    v_result := jsonb_build_object(
      'success', true,
      'processed_count', v_processed_count,
      'reset_count', v_reset_count,
      'duration_ms', extract(epoch from (now() - v_start_time)) * 1000,
      'correlation_id', v_correlation_id
    );
  EXCEPTION WHEN OTHERS THEN
    -- Capture the error
    v_error := SQLERRM;
    
    -- Log error
    INSERT INTO unified_audit_logs (
      event_type,
      correlation_id,
      error_message,
      metadata,
      event_timestamp
    ) VALUES (
      'scheduler_process_error',
      v_correlation_id,
      v_error,
      jsonb_build_object(
        'run_time', v_start_time,
        'error_detail', SQLSTATE,
        'duration_ms', extract(epoch from (now() - v_start_time)) * 1000
      ),
      now()
    );
    
    -- Return error result
    v_result := jsonb_build_object(
      'success', false,
      'error', v_error,
      'duration_ms', extract(epoch from (now() - v_start_time)) * 1000,
      'correlation_id', v_correlation_id
    );
  END;
  
  -- Log the completion event
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    error_message,
    metadata,
    event_timestamp
  ) VALUES (
    'scheduler_process_completed',
    v_correlation_id,
    v_error,
    v_result,
    now()
  );
  
  RETURN v_result;
END;
$$;

-- Update the cron scheduler to use the latest function - Fixed syntax here
DO $$
BEGIN
    -- Try to unschedule existing job if it exists
    BEGIN
        PERFORM cron.unschedule('process-pending-messages');
    EXCEPTION WHEN OTHERS THEN
        -- Job doesn't exist, that's fine
    END;
    
    -- Create the job if it doesn't already exist
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-messages') THEN
        PERFORM cron.schedule(
            'process-pending-messages',
            '*/5 * * * *',
            'SELECT xdelo_run_scheduled_message_processing();'
        );
    END IF;
END
$$;

COMMIT;
