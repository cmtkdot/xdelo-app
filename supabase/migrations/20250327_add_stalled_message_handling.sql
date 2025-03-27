-- Migration to add comprehensive stalled message handling

-- 1. Create the reset function for processing messages
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Reset messages stuck in processing state
  UPDATE messages
  SET processing_state = 'pending',
      error_message = 'Reset from stalled processing',
      updated_at = NOW()
  WHERE processing_state = 'processing'
    AND processing_started_at < NOW() - interval '15 minutes'
  RETURNING COUNT(*) INTO v_count;

  -- Also reset messages stuck in pending state
  UPDATE messages
  SET error_message = 'Reset from stalled pending',
      updated_at = NOW()
  WHERE processing_state = 'pending'
    AND processing_started_at < NOW() - interval '15 minutes'
  RETURNING COUNT(*) INTO v_count;

  IF v_count > 0 THEN
    INSERT INTO unified_audit_logs (
      event_type,
      entity_type,
      metadata
    ) VALUES (
      'stalled_messages_reset',
      'system',
      jsonb_build_object(
        'count', v_count,
        'timestamp', NOW()
      )
    );
  END IF;
END;
$function$;

-- 2. Create a cleanup function for timed out messages
CREATE OR REPLACE FUNCTION public.xdelo_cleanup_stalled_processing()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Mark processing messages as errored after 1 hour
  UPDATE messages
  SET processing_state = 'error',
      error_message = 'Processing timed out',
      last_error_at = NOW()
  WHERE processing_state = 'processing'
    AND processing_started_at < (NOW() - INTERVAL '1 hour');

  -- Mark pending messages as errored after 1 hour
  UPDATE messages
  SET processing_state = 'error',
      error_message = 'Pending timed out',
      last_error_at = NOW()
  WHERE processing_state = 'pending'
    AND processing_started_at < (NOW() - INTERVAL '1 hour');
END;
$function$;

-- 3. Create a scheduled job to run these functions periodically
COMMENT ON FUNCTION public.xdelo_reset_stalled_messages() IS 'Resets messages stuck in processing/pending state for too long';
COMMENT ON FUNCTION public.xdelo_cleanup_stalled_processing() IS 'Marks messages as errored if stuck too long in processing/pending state';

-- 4. Set up cron jobs to run these functions
SELECT cron.schedule(
  'reset-stalled-messages',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT public.xdelo_reset_stalled_messages()$$
);

SELECT cron.schedule(
  'cleanup-stalled-processing',
  '*/15 * * * *', -- Every 15 minutes
  $$SELECT public.xdelo_cleanup_stalled_processing()$$
);
