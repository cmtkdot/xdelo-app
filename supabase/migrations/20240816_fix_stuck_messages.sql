
-- Start transaction
BEGIN;

-- Create a function to reset all stuck messages
CREATE OR REPLACE FUNCTION xdelo_reset_all_stuck_messages()
RETURNS TABLE(message_id uuid, previous_state text, reset_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id uuid := gen_random_uuid();
BEGIN
  -- First, reset any messages that have been stuck in 'processing' state
  UPDATE messages
  SET 
    processing_state = 'pending',
    processing_started_at = NULL,
    error_message = 'Reset by admin operation',
    retry_count = COALESCE(retry_count, 0) + 1,
    updated_at = now()
  WHERE processing_state = 'processing'
    AND (analyzed_content IS NULL OR analyzed_content = 'null'::jsonb)
  RETURNING 
    id, 
    'processing', 
    'stuck_in_processing' 
  INTO message_id, previous_state, reset_reason;
  
  -- Second, make sure any messages with captions but in 'initialized' state are set to 'pending'
  UPDATE messages
  SET 
    processing_state = 'pending',
    updated_at = now()
  WHERE processing_state = 'initialized'
    AND caption IS NOT NULL
    AND caption != ''
    AND (analyzed_content IS NULL OR analyzed_content = 'null'::jsonb)
  RETURNING 
    id, 
    'initialized', 
    'has_caption_needs_processing' 
  INTO message_id, previous_state, reset_reason;
    
  -- Log the operation
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'system_maintenance_completed',
    v_correlation_id,
    jsonb_build_object(
      'operation', 'batch_reset_stuck_messages',
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN QUERY
  SELECT message_id, previous_state, reset_reason
  WHERE message_id IS NOT NULL;
END;
$$;

-- This function will check and repair any orphaned media group messages
CREATE OR REPLACE FUNCTION xdelo_repair_orphaned_media_group_messages()
RETURNS TABLE(message_id uuid, media_group_id text, fixed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group record;
  v_source_message_id uuid;
  v_media_group_id text;
  v_success boolean;
  v_correlation_id uuid := gen_random_uuid();
BEGIN
  -- Find media groups where some messages are processed and others are not
  FOR v_group IN
    SELECT 
      mg.media_group_id,
      COUNT(*) FILTER (WHERE m.analyzed_content IS NOT NULL) AS processed_count,
      COUNT(*) FILTER (WHERE m.analyzed_content IS NULL) AS unprocessed_count
    FROM messages m
    JOIN (
      SELECT DISTINCT media_group_id 
      FROM messages 
      WHERE media_group_id IS NOT NULL
    ) mg ON m.media_group_id = mg.media_group_id
    GROUP BY mg.media_group_id
    HAVING 
      COUNT(*) FILTER (WHERE m.analyzed_content IS NOT NULL) > 0 
      AND COUNT(*) FILTER (WHERE m.analyzed_content IS NULL) > 0
  LOOP
    -- For each group with mixed processing states, find the source message with content
    SELECT id INTO v_source_message_id
    FROM messages
    WHERE media_group_id = v_group.media_group_id
    AND analyzed_content IS NOT NULL
    AND processing_state = 'completed'
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- If we found a source message, sync its content to other messages in the group
    IF v_source_message_id IS NOT NULL THEN
      v_media_group_id := v_group.media_group_id;
      
      BEGIN
        -- Use the sync function to propagate the content
        PERFORM xdelo_sync_media_group_content(
          v_source_message_id, 
          v_media_group_id, 
          v_correlation_id, 
          true, 
          false
        );
        
        v_success := true;
      EXCEPTION WHEN OTHERS THEN
        -- Log the error but continue with other groups
        v_success := false;
        
        INSERT INTO unified_audit_logs (
          event_type,
          error_message,
          correlation_id,
          metadata,
          event_timestamp
        ) VALUES (
          'media_group_repair_error',
          SQLERRM,
          v_correlation_id,
          jsonb_build_object(
            'media_group_id', v_media_group_id,
            'source_message_id', v_source_message_id
          ),
          NOW()
        );
      END;
      
      -- Return the result
      message_id := v_source_message_id;
      media_group_id := v_media_group_id;
      fixed := v_success;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- Log completion
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_repair_completed',
    v_correlation_id,
    jsonb_build_object(
      'operation', 'batch_orphaned_group_repair',
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN;
END;
$$;

-- Run the functions to fix stuck messages and orphaned media groups
SELECT xdelo_reset_all_stuck_messages();
SELECT xdelo_repair_orphaned_media_group_messages();

COMMIT;
