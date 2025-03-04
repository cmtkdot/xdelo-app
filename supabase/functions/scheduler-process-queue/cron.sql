
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
    -- First drop the existing function if it exists
    DROP FUNCTION IF EXISTS xdelo_process_pending_messages(integer);
    
    -- Create the new function with proper signature
    CREATE OR REPLACE FUNCTION xdelo_process_pending_messages(limit_count integer DEFAULT 20)
    RETURNS TABLE(message_id uuid, processed boolean, error_message text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE
      v_message record;
      v_correlation_id text;
      v_result jsonb;
      v_success boolean;
      v_error text;
    BEGIN
      -- Process up to limit_count messages currently marked as pending
      FOR v_message IN 
        SELECT id, caption, media_group_id, correlation_id
        FROM messages
        WHERE processing_state = 'pending'
        AND caption IS NOT NULL
        AND caption != ''
        LIMIT limit_count
      LOOP
        BEGIN
          v_correlation_id := COALESCE(v_message.correlation_id, gen_random_uuid()::text);
          
          -- First try to sync from media group if applicable
          IF v_message.media_group_id IS NOT NULL THEN
            v_result := public.xdelo_check_media_group_content(
              v_message.media_group_id,
              v_message.id,
              v_correlation_id
            );
            
            IF (v_result->>'success')::boolean THEN
              -- Successfully synced from media group
              message_id := v_message.id;
              processed := true;
              error_message := null;
              RETURN NEXT;
              CONTINUE;
            END IF;
          END IF;
          
          -- If no caption or media group sync failed, mark as error
          IF v_message.caption IS NULL OR v_message.caption = '' THEN
            UPDATE messages
            SET 
              processing_state = 'error',
              error_message = 'No caption to analyze',
              last_error_at = now(),
              retry_count = COALESCE(retry_count, 0) + 1
            WHERE id = v_message.id;
            
            message_id := v_message.id;
            processed := false;
            error_message := 'No caption to analyze';
            RETURN NEXT;
            CONTINUE;
          END IF;
          
          -- Message needs manual analysis - mark to be picked up by external processor
          UPDATE messages
          SET 
            processing_state = 'processing',
            processing_started_at = now()
          WHERE id = v_message.id;
          
          -- Return as processed to indicate it's been picked up
          message_id := v_message.id;
          processed := true;
          error_message := null;
          RETURN NEXT;
          
        EXCEPTION WHEN OTHERS THEN
          -- Handle errors
          UPDATE messages
          SET 
            processing_state = 'error',
            error_message = SQLERRM,
            last_error_at = now(),
            retry_count = COALESCE(retry_count, 0) + 1
          WHERE id = v_message.id;
          
          message_id := v_message.id;
          processed := false;
          error_message := SQLERRM;
          RETURN NEXT;
        END;
      END LOOP;
    END;
    $func$;
    
    -- First drop the existing function if it exists
    DROP FUNCTION IF EXISTS xdelo_reset_stalled_messages();
    
    -- Function to reset stalled messages
    CREATE OR REPLACE FUNCTION xdelo_reset_stalled_messages()
    RETURNS TABLE(message_id uuid, reset_reason text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    BEGIN
      -- Reset messages stuck in 'processing' state for more than 15 minutes
      UPDATE messages
      SET 
        processing_state = 'pending',
        error_message = 'Reset due to stalled processing',
        retry_count = COALESCE(retry_count, 0) + 1
      WHERE processing_state = 'processing'
        AND processing_started_at < now() - interval '15 minutes'
      RETURNING id, 'stalled_processing' INTO message_id, reset_reason;
      
      RETURN QUERY
      SELECT message_id, reset_reason
      WHERE message_id IS NOT NULL;
    END;
    $func$;
    
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

-- Safely unschedule jobs before creating new ones
DO $$
BEGIN
    -- Try to unschedule existing jobs if they exist (ignore errors)
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
END $$;

-- Add job to run every 15 minutes (checking first if it already exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-pending-messages') THEN
        PERFORM cron.schedule(
            'process-pending-messages',
            '*/15 * * * *',
            $$
            SELECT xdelo_run_scheduled_message_processing();
            $$
        );
    END IF;
END
$$;

-- Create a job to perform daily maintenance and cleanup
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xdelo-daily-maintenance') THEN
        PERFORM cron.schedule(
            'xdelo-daily-maintenance',
            '0 3 * * *', -- Run at 3 AM daily
            $$
            BEGIN
                -- Cleanup old audit logs 
                DELETE FROM unified_audit_logs 
                WHERE event_timestamp < NOW() - INTERVAL '30 days';
                
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
    END IF;
END
$$;
