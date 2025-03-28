
-- Set up cron jobs for message processing and cleanup
-- Make sure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Function to automatically process pending messages
CREATE OR REPLACE FUNCTION public.xdelo_process_pending_messages()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result json;
BEGIN
  -- Call the direct-caption-processor edge function
  SELECT content::json INTO v_result
  FROM http((
    'POST',
    CASE 
      WHEN current_setting('server_version_num')::int >= 100000 THEN
        (SELECT value FROM pg_settings WHERE name = 'supabase_url')
      ELSE 
        'http://localhost:54321'
    END || '/functions/v1/direct-caption-processor',
    ARRAY[
      ('Content-Type', 'application/json'),
      ('Authorization', 'Bearer ' || (SELECT value FROM pg_settings WHERE name = 'supabase.anon_key'))
    ],
    'application/json',
    '{"batchSize": 10}'
  ));

  -- Log the outcome
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  ) VALUES (
    'pending_message_processor',
    'system',
    jsonb_build_object(
      'result', v_result,
      'timestamp', NOW()
    )
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  -- Log errors
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    error_message,
    metadata
  ) VALUES (
    'pending_message_processor_error',
    'system',
    SQLERRM,
    jsonb_build_object(
      'timestamp', NOW()
    )
  );
  
  RETURN json_build_object('error', SQLERRM);
END;
$function$;

-- Schedule the cron job to run every minute
SELECT cron.schedule(
  'process-pending-messages',
  '* * * * *',
  'SELECT xdelo_process_pending_messages()'
);

-- Create a function to reset stalled messages
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages(p_timeout_minutes integer DEFAULT 15)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_reset_count integer := 0;
BEGIN
  -- Reset messages stuck in processing state for more than specified minutes
  UPDATE messages
  SET 
    processing_state = 'pending',
    error_message = 'Reset from stalled processing',
    updated_at = NOW(),
    retry_count = COALESCE(retry_count, 0) + 1
  WHERE 
    processing_state = 'processing'
    AND processing_started_at < (NOW() - (p_timeout_minutes || ' minutes')::interval)
  RETURNING COUNT(*) INTO v_reset_count;

  -- Log the reset operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  ) VALUES (
    'stalled_messages_reset',
    'system',
    jsonb_build_object(
      'count', v_reset_count,
      'timeout_minutes', p_timeout_minutes,
      'timestamp', NOW()
    )
  );

  RETURN json_build_object(
    'reset_count', v_reset_count,
    'timestamp', NOW()
  );
END;
$function$;

-- Schedule the stalled message reset to run every 5 minutes
SELECT cron.schedule(
  'reset-stalled-messages',
  '*/5 * * * *',
  'SELECT xdelo_reset_stalled_messages(15)'
);
