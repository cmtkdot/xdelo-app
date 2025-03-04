
-- Start transaction
BEGIN;

-- 1. First, drop dependent views with CASCADE to avoid constraint violations
DROP VIEW IF EXISTS public.v_messages_with_relationships CASCADE;
DROP VIEW IF EXISTS public.v_message_relationships CASCADE;
DROP VIEW IF EXISTS public.v_queue_status CASCADE;

-- 2. Now drop the queue table, which should succeed without dependency issues
DROP TABLE IF EXISTS public.message_processing_queue CASCADE;

-- 3. Drop queue-related functions
DROP FUNCTION IF EXISTS public.xdelo_get_next_message_for_processing(integer);
DROP FUNCTION IF EXISTS public.xdelo_complete_message_processing(uuid, jsonb);
DROP FUNCTION IF EXISTS public.xdelo_fail_message_processing(uuid, text);
DROP FUNCTION IF EXISTS public.xdelo_queue_message_for_processing(uuid, text);
DROP FUNCTION IF EXISTS public.xdelo_cleanup_old_queue_entries(integer);
DROP FUNCTION IF EXISTS public.xdelo_cleanup_old_queue_entries();
DROP FUNCTION IF EXISTS public.process_glide_sync_queue();
DROP FUNCTION IF EXISTS public.schedule_sync_check();
DROP FUNCTION IF EXISTS public.xdelo_diagnose_queue_issues();

-- 4. Clean up scheduler by using safer method that works with restricted privileges
-- Instead of directly deleting from cron.job table, use the cron.unschedule function
SELECT cron.unschedule('process-message-queue');
SELECT cron.unschedule('xdelo-daily-maintenance');

-- 5. Clean up any remaining old logging entries
DELETE FROM unified_audit_logs 
WHERE event_type IN (
    'message_queued_for_processing',
    'queue_processing_started',
    'queue_processing_completed'
);

-- 6. Create new functions for direct message processing (without queue)
CREATE OR REPLACE FUNCTION public.xdelo_process_pending_messages(limit_count integer DEFAULT 20)
RETURNS TABLE(message_id uuid, processed boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Function to reset stalled messages
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages()
RETURNS TABLE(message_id uuid, reset_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- 7. Update the media group content check function to remove processing_state references
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_content(
  p_media_group_id text, 
  p_message_id uuid, 
  p_correlation_id text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  PERFORM id FROM messages 
  WHERE id = p_message_id 
  AND caption IS NOT NULL 
  AND caption != '';
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'message_has_caption',
      'message_id', p_message_id,
      'should_analyze', true
    );
  END IF;
  
  -- Find any message in the group with analyzed content
  UPDATE messages
  SET 
    analyzed_content = (
      SELECT analyzed_content
      FROM messages
      WHERE media_group_id = p_media_group_id
      AND analyzed_content IS NOT NULL
      AND id != p_message_id
      ORDER BY created_at ASC
      LIMIT 1
    ),
    message_caption_id = (
      SELECT id
      FROM messages
      WHERE media_group_id = p_media_group_id
      AND analyzed_content IS NOT NULL
      AND id != p_message_id
      ORDER BY created_at ASC
      LIMIT 1
    ),
    is_original_caption = false,
    group_caption_synced = true,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_message_id
  AND EXISTS (
    SELECT 1
    FROM messages
    WHERE media_group_id = p_media_group_id
    AND analyzed_content IS NOT NULL
    AND id != p_message_id
  );
  
  IF FOUND THEN
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
        'operation', 'check_and_sync'
      ),
      p_correlation_id,
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Content synced from media group'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'reason', 'no_analyzed_content_in_group'
  );
END;
$$;

-- 8. Create a new cron job to process pending messages regularly
SELECT cron.schedule(
  'process-pending-messages',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT * FROM xdelo_process_pending_messages(20);
  $$
);

-- 9. Create a maintenance job for daily cleanup
SELECT cron.schedule(
  'xdelo-daily-maintenance',
  '0 3 * * *',  -- Run at 3 AM daily
  $$
  BEGIN
    -- Cleanup old audit logs 
    DELETE FROM unified_audit_logs 
    WHERE event_timestamp < NOW() - INTERVAL '30 days';
    
    -- Reset any messages stuck in processing state for over 24 hours
    UPDATE messages
    SET processing_state = 'pending',
        error_message = 'Reset by maintenance job after 24h',
        retry_count = COALESCE(retry_count, 0) + 1
    WHERE processing_state = 'processing'
      AND processing_started_at < NOW() - INTERVAL '24 hours';
    
    -- Log maintenance completion
    INSERT INTO unified_audit_logs (
      event_type,
      metadata,
      event_timestamp
    ) VALUES (
      'system_maintenance_completed',
      jsonb_build_object(
        'maintenance_type', 'scheduled_daily'
      ),
      NOW()
    );
  END;
  $$
);

COMMIT;
