
-- Fix the correlation_id type mismatch in queue processing function
CREATE OR REPLACE FUNCTION public.xdelo_queue_message_for_processing(
  p_message_id uuid, 
  p_correlation_id text -- Explicitly accepting text type
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_queue_id UUID;
    v_message messages;
    v_correlation_uuid UUID;
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
    SELECT id INTO v_queue_id
    FROM message_processing_queue 
    WHERE message_id = p_message_id 
    AND status IN ('pending', 'processing')
    LIMIT 1;
    
    IF FOUND THEN
        RETURN v_queue_id;
    END IF;
    
    -- Safely convert text correlation_id to UUID for database columns that require UUID
    BEGIN
        -- Try to convert to UUID if it looks like a UUID
        v_correlation_uuid := p_correlation_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        -- If conversion fails, generate a new UUID
        v_correlation_uuid := gen_random_uuid();
    END;
    
    -- Insert new queue entry (using text correlation_id for metadata)
    INSERT INTO message_processing_queue (
        message_id,
        correlation_id,
        status,
        metadata
    ) VALUES (
        p_message_id,
        v_correlation_uuid, -- Use UUID version for the database column
        'pending',
        jsonb_build_object(
            'caption', v_message.caption,
            'media_group_id', v_message.media_group_id,
            'queue_time', NOW(),
            'original_correlation_id', p_correlation_id, -- Store original text version in metadata
            'is_converted_uuid', (v_correlation_uuid::text != p_correlation_id) -- Flag if we had to generate a new UUID
        )
    ) RETURNING id INTO v_queue_id;
    
    -- Update message processing state (using UUID for database column)
    UPDATE messages
    SET 
        processing_state = 'pending',
        processing_correlation_id = v_correlation_uuid, -- Use UUID version for the database column
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the operation (unified_audit_logs uses text for correlation_id)
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_queued_for_processing',
        p_message_id,
        p_correlation_id, -- Use original text version for audit logs
        jsonb_build_object(
            'queue_id', v_queue_id,
            'caption_length', length(v_message.caption),
            'media_group_id', v_message.media_group_id,
            'correlation_uuid', v_correlation_uuid
        ),
        NOW()
    );
    
    RETURN v_queue_id;
END;
$$;

-- Also need to update the related functions for complete processing flow
CREATE OR REPLACE FUNCTION public.xdelo_complete_message_processing(
  p_queue_id uuid, 
  p_analyzed_content jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_correlation_id TEXT;
    v_media_group_id TEXT;
BEGIN
    -- Get the necessary data
    SELECT 
        message_id, 
        correlation_id::text, -- Convert UUID to text explicitly 
        metadata->>'media_group_id' 
    INTO v_message_id, v_correlation_id, v_media_group_id
    FROM message_processing_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE message_processing_queue
    SET 
        status = 'completed',
        processing_completed_at = NOW(),
        metadata = metadata || jsonb_build_object('analyzed_content', p_analyzed_content)
    WHERE id = p_queue_id;
    
    -- Update the message with analyzed content and mark as the original caption holder for the group
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = 'completed',
        processing_completed_at = NOW(),
        is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the completion
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_completed',
        v_message_id,
        v_correlation_id, -- Using text correlation_id for audit logs
        jsonb_build_object(
            'queue_id', p_queue_id,
            'media_group_id', v_media_group_id,
            'product_name', p_analyzed_content->>'product_name',
            'vendor_uid', p_analyzed_content->>'vendor_uid'
        ),
        NOW()
    );
    
    -- If this is part of a media group, sync the analyzed content to other messages
    IF v_media_group_id IS NOT NULL THEN
        -- Update all other messages in the group
        UPDATE messages
        SET 
            analyzed_content = p_analyzed_content,
            processing_state = 'completed',
            group_caption_synced = true,
            message_caption_id = v_message_id,
            processing_completed_at = NOW(),
            updated_at = NOW()
        WHERE 
            media_group_id = v_media_group_id 
            AND id != v_message_id;
            
        -- Log the sync operation
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            metadata,
            correlation_id,
            event_timestamp
        ) VALUES (
            'media_group_synced',
            v_message_id,
            jsonb_build_object(
                'media_group_id', v_media_group_id,
                'source_message_id', v_message_id
            ),
            v_correlation_id, -- Using text correlation_id for audit logs
            NOW()
        );
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Update fail function to handle correlation_id correctly
CREATE OR REPLACE FUNCTION public.xdelo_fail_message_processing(
  p_queue_id uuid, 
  p_error_message text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_correlation_id TEXT;
    v_attempts INT;
    v_max_attempts INT;
BEGIN
    -- Get the necessary data
    SELECT 
        message_id, 
        correlation_id::text, -- Convert UUID to text explicitly
        attempts, 
        max_attempts
    INTO v_message_id, v_correlation_id, v_attempts, v_max_attempts
    FROM message_processing_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE message_processing_queue
    SET 
        status = CASE WHEN v_attempts >= v_max_attempts THEN 'failed' ELSE 'pending' END,
        error_message = p_error_message,
        last_error_at = NOW(),
        metadata = metadata || jsonb_build_object('last_error', p_error_message)
    WHERE id = p_queue_id;
    
    -- Update the message state
    UPDATE messages
    SET 
        processing_state = CASE WHEN v_attempts >= v_max_attempts THEN 'error' ELSE 'pending' END,
        error_message = p_error_message,
        last_error_at = NOW(),
        retry_count = COALESCE(retry_count, 0) + 1,
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the failure
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        CASE WHEN v_attempts >= v_max_attempts THEN 'message_processing_failed' ELSE 'message_processing_retry' END,
        v_message_id,
        v_correlation_id, -- Using text correlation_id for audit logs
        p_error_message,
        jsonb_build_object(
            'queue_id', p_queue_id,
            'attempts', v_attempts,
            'max_attempts', v_max_attempts
        ),
        NOW()
    );
    
    RETURN TRUE;
END;
$$;

-- Add a diagnostic function to help troubleshoot correlation_id issues
CREATE OR REPLACE FUNCTION public.xdelo_diagnose_queue_issues()
RETURNS jsonb
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
        error_message = 'Reset by system diagnostic due to stalled state'
    WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS v_fix_count = ROW_COUNT;
    v_error_messages := array_append(v_error_messages, 'Reset ' || v_fix_count || ' stalled queue entries');
    
    -- Check for missing analyzed_content in media groups
    BEGIN
        PERFORM xdelo_sync_media_group_content(
            (SELECT id FROM messages WHERE is_original_caption = true AND media_group_id IS NOT NULL LIMIT 1),
            (SELECT media_group_id FROM messages WHERE is_original_caption = true AND media_group_id IS NOT NULL LIMIT 1)
        );
        v_error_messages := array_append(v_error_messages, 'Media group sync: OK');
    EXCEPTION WHEN OTHERS THEN
        v_error_messages := array_append(v_error_messages, 'Media group sync error: ' || SQLERRM);
    END;
    
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

-- Update the auto-queue trigger to handle the correlation_id properly
CREATE OR REPLACE FUNCTION public.xdelo_auto_queue_messages()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_correlation_id TEXT;
BEGIN
  -- Only proceed if caption has changed and is not null
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.caption IS NULL OR OLD.caption <> NEW.caption))) 
     AND NEW.caption IS NOT NULL AND trim(NEW.caption) <> '' THEN
      
    -- Only if not already in processing or completed state
    IF NEW.processing_state IS NULL OR NEW.processing_state IN ('initialized', 'pending', 'error') THEN
      -- Generate a correlation ID if needed
      v_correlation_id := COALESCE(NEW.correlation_id, gen_random_uuid()::TEXT);
      
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
          'correlation_id', v_correlation_id,
          'caption', NEW.caption,
          'processing_state', NEW.processing_state,
          'trigger_operation', TG_OP
        ),
        NOW()
      );
    
      -- Queue for processing explicitly as text
      BEGIN
        PERFORM xdelo_queue_message_for_processing(
          NEW.id, 
          v_correlation_id
        );
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
            'correlation_id', v_correlation_id,
            'caption', NEW.caption,
            'error_detail', SQLSTATE
          ),
          NOW()
        );
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
