
-- Start transaction
BEGIN;

-- 1. Drop queue-related functions
DROP FUNCTION IF EXISTS public.xdelo_get_next_message_for_processing(integer);
DROP FUNCTION IF EXISTS public.xdelo_complete_message_processing(uuid, jsonb);
DROP FUNCTION IF EXISTS public.xdelo_fail_message_processing(uuid, text);
DROP FUNCTION IF EXISTS public.xdelo_queue_message_for_processing(uuid, text);
DROP FUNCTION IF EXISTS public.xdelo_cleanup_old_queue_entries(integer);
DROP FUNCTION IF EXISTS public.xdelo_cleanup_old_queue_entries();
DROP FUNCTION IF EXISTS public.process_glide_sync_queue();
DROP FUNCTION IF EXISTS public.schedule_sync_check();
DROP FUNCTION IF EXISTS public.xdelo_diagnose_queue_issues();

-- 2. Drop the queue table if it exists
DROP TABLE IF EXISTS public.message_processing_queue;

-- 3. Clean up scheduler if it exists
DELETE FROM cron.job WHERE jobname = 'process-message-queue';

-- 4. Clean up any remaining old logging entries
DELETE FROM unified_audit_logs 
WHERE event_type IN (
    'message_queued_for_processing',
    'queue_processing_started',
    'queue_processing_completed'
);

-- 5. Remove the 'processing_state' column references from existing functions
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

COMMIT;

