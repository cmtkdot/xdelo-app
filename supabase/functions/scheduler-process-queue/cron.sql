
-- Enable the required extensions if not already enabled
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Function to handle cron job execution with error tracking
CREATE OR REPLACE FUNCTION xdelo_run_scheduled_message_processing()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time timestamptz := now();
  v_correlation_id uuid := gen_random_uuid();
  v_processed_count integer;
  v_reset_count integer;
  v_error text;
  v_result jsonb;
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
    -- Process any pending messages directly
    SELECT COUNT(*) INTO v_processed_count 
    FROM xdelo_process_pending_messages(20);
    
    -- Reset any stalled messages
    SELECT COUNT(*) INTO v_reset_count 
    FROM xdelo_reset_stalled_messages();
    
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

-- Schedule the function to run every 15 minutes
select cron.schedule(
  'process-pending-messages',
  '*/15 * * * *',
  $$
  BEGIN
    PERFORM xdelo_run_scheduled_message_processing();
  END;
  $$
);

-- Create a job to perform daily maintenance and cleanup
select cron.schedule(
  'xdelo-daily-maintenance',
  '0 3 * * *', -- Run at 3 AM daily
  $$
  BEGIN
    -- Cleanup old queue entries
    DELETE FROM message_processing_queue 
    WHERE processing_completed_at < NOW() - INTERVAL '7 days'
      OR (status = 'error' AND last_error_at < NOW() - INTERVAL '7 days');
    
    -- Vacuum tables to reclaim space
    VACUUM ANALYZE messages;
    VACUUM ANALYZE unified_audit_logs;
    
    -- Log maintenance completion
    INSERT INTO unified_audit_logs (
      event_type,
      metadata,
      event_timestamp
    ) VALUES (
      'system_maintenance_completed',
      jsonb_build_object(
        'maintenance_type', 'scheduled_daily',
        'tables_vacuumed', jsonb_build_array('messages', 'unified_audit_logs')
      ),
      NOW()
    );
  END;
  $$
);
