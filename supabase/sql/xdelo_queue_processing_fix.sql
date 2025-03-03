
-- Fix the queue processing function to properly handle text correlation_id

-- 1. Update the function signature to accept text correlation_id
CREATE OR REPLACE FUNCTION xdelo_queue_message_for_processing(
    p_message_id UUID,
    p_correlation_id TEXT DEFAULT gen_random_uuid()::TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_id UUID;
    v_message messages;
BEGIN
    -- Check if message exists and has caption
    SELECT * INTO v_message
    FROM messages
    WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;
    
    -- Only queue messages with captions
    IF v_message.caption IS NULL OR trim(v_message.caption) = '' THEN
        RAISE EXCEPTION 'Message has no caption to process';
    END IF;
    
    -- Check if already queued and pending
    IF EXISTS (
        SELECT 1 FROM message_processing_queue 
        WHERE message_id = p_message_id 
        AND status IN ('pending', 'processing')
    ) THEN
        SELECT id INTO v_queue_id
        FROM message_processing_queue 
        WHERE message_id = p_message_id 
        AND status IN ('pending', 'processing')
        LIMIT 1;
        
        RETURN v_queue_id;
    END IF;
    
    -- Insert new queue entry
    INSERT INTO message_processing_queue (
        message_id,
        correlation_id,
        status,
        metadata
    ) VALUES (
        p_message_id,
        p_correlation_id,
        'pending',
        jsonb_build_object(
            'caption', v_message.caption,
            'media_group_id', v_message.media_group_id,
            'queue_time', NOW()
        )
    ) RETURNING id INTO v_queue_id;
    
    -- Update message processing state
    UPDATE messages
    SET 
        processing_state = 'pending',
        processing_correlation_id = p_correlation_id::uuid,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the operation
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_queued_for_processing',
        p_message_id,
        p_correlation_id,
        jsonb_build_object(
            'queue_id', v_queue_id,
            'caption_length', length(v_message.caption),
            'media_group_id', v_message.media_group_id
        ),
        NOW()
    );
    
    RETURN v_queue_id;
END;
$$;

-- 2. Fix the auto queue messages trigger function
CREATE OR REPLACE FUNCTION xdelo_auto_queue_messages()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Queue messages with captions for processing
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.caption IS NULL OR OLD.caption <> NEW.caption))) 
     AND xdelo_has_valid_caption(NEW.caption) THEN
      
    -- Only if not already in processing or completed state
    IF NEW.processing_state IS NULL OR NEW.processing_state IN ('initialized', 'pending', 'error') THEN
      -- Log the trigger activation
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        event_timestamp
      ) VALUES (
        'trigger_auto_queue_activated',
        NEW.id,
        jsonb_build_object(
          'correlation_id', NEW.correlation_id,
          'caption', NEW.caption,
          'processing_state', NEW.processing_state,
          'trigger_operation', TG_OP
        ),
        NOW()
      );
    
      -- Queue for processing using DB function with text correlation_id
      BEGIN
        -- Ensure correlation_id is passed as TEXT type
        PERFORM xdelo_queue_message_for_processing(NEW.id, NEW.correlation_id::TEXT);
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the whole transaction
        INSERT INTO unified_audit_logs (
          event_type,
          entity_id,
          error_message,
          metadata,
          event_timestamp
        ) VALUES (
          'trigger_queue_error',
          NEW.id,
          SQLERRM,
          jsonb_build_object(
            'correlation_id', NEW.correlation_id,
            'caption', NEW.caption,
            'error_detail', SQLSTATE
          ),
          NOW()
        );
      END;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 3. Fix the trigger application - drop and recreate with the fixed function
DROP TRIGGER IF EXISTS xdelo_auto_queue_messages_trigger ON messages;
CREATE TRIGGER xdelo_auto_queue_messages_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_auto_queue_messages();

-- 4. Create a function to run immediate diagnosis and repair on queue issues
CREATE OR REPLACE FUNCTION xdelo_diagnose_queue_issues()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_results JSONB;
    v_error_messages TEXT[];
    v_fix_count INTEGER := 0;
BEGIN
    -- Check for type mismatch in correlation_id
    BEGIN
        -- Test the queue function with explicit TEXT parameter
        PERFORM xdelo_queue_message_for_processing(
            (SELECT id FROM messages WHERE caption IS NOT NULL LIMIT 1),
            'test_correlation_id'
        );
        v_error_messages := array_append(v_error_messages, 'Queue function with TEXT parameter: OK');
    EXCEPTION WHEN OTHERS THEN
        v_error_messages := array_append(v_error_messages, 'Queue function error: ' || SQLERRM);
    END;
    
    -- Check for stalled queue entries
    UPDATE message_processing_queue
    SET status = 'error',
        error = 'Reset by system diagnostic due to stalled state'
    WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_fix_count = ROW_COUNT;
    v_error_messages := array_append(v_error_messages, 'Reset ' || v_fix_count || ' stalled queue entries');
    
    -- Check for missing analyzed_content in media groups
    PERFORM xdelo_sync_media_group_content(
        (SELECT id FROM messages WHERE is_original_caption = true AND media_group_id IS NOT NULL LIMIT 1),
        (SELECT media_group_id FROM messages WHERE is_original_caption = true AND media_group_id IS NOT NULL LIMIT 1)
    );
    
    -- Repair message relationships
    WITH fixed AS (
        SELECT * FROM xdelo_repair_message_relationships()
    )
    SELECT json_agg(fixed) INTO v_results FROM fixed;
    
    RETURN jsonb_build_object(
        'status', 'completed',
        'diagnostics', v_error_messages,
        'fixed_relationships', COALESCE(v_results, '[]'::jsonb)
    );
END;
$$;
