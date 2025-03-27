
-- Fix caption processing workflow to properly use pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop the old function
DROP FUNCTION IF EXISTS public.xdelo_process_caption_workflow;

-- Recreate the function with proper pg_net usage
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
  p_message_id UUID, 
  p_correlation_id TEXT DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_message messages;
  v_caption TEXT;
  v_media_group_id TEXT;
  v_analyzed_content JSONB;
  v_correlation_uuid uuid;
  v_parse_result JSONB;
  v_request_id TEXT;
  v_response_id TEXT;
  v_request_status JSONB;
  v_response JSONB;
  v_http_status INT;
  v_http_response TEXT;
  v_api_url TEXT;
  v_supabase_url TEXT;
  v_auth_key TEXT;
BEGIN
  -- Get Supabase URL from settings
  SELECT current_setting('app.settings.supabase_url', true) INTO v_supabase_url;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://' || current_setting('request.headers')::json->>'host';
  END IF;
  
  -- Get auth key from settings or use service role default
  SELECT current_setting('app.settings.service_role_key', true) INTO v_auth_key;
  IF v_auth_key IS NULL THEN
    v_auth_key := current_setting('request.jwt.claim.service_role', true);
  END IF;

  -- Construct API URL
  v_api_url := v_supabase_url || '/functions/v1/parse-caption';

  -- Convert correlation_id to UUID if provided, otherwise generate new one
  v_correlation_uuid := CASE
    WHEN p_correlation_id IS NOT NULL THEN
      CASE
        WHEN p_correlation_id::uuid IS NOT NULL THEN p_correlation_id::uuid
        ELSE gen_random_uuid()
      END
    ELSE gen_random_uuid()
  END;

  -- Get the message
  SELECT * INTO v_message FROM messages WHERE id = p_message_id;

  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Message not found',
      'message_id', p_message_id
    );
  END IF;

  -- Reset processing state regardless of previous status
  UPDATE messages
  SET processing_state = 'processing',
      processing_started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_message_id;

  -- Log the processing start
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_processing_started',
    p_message_id,
    v_correlation_uuid::text,
    jsonb_build_object(
      'processor', 'xdelo_process_caption_workflow',
      'start_time', NOW(),
      'force', p_force
    ),
    NOW()
  );

  v_caption := v_message.caption;
  v_media_group_id := v_message.media_group_id;

  -- Check if caption exists
  IF v_caption IS NULL OR v_caption = '' THEN
    -- For messages without caption, keep in processing state
    IF v_media_group_id IS NULL THEN
      -- Not part of media group - just update state
      UPDATE messages
      SET processing_state = 'processing',
          updated_at = NOW()
      WHERE id = p_message_id;

      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'No caption to process, kept in processing state',
        'message_id', p_message_id
      );
    ELSE
      -- For media group messages without caption, sync from group
      RETURN xdelo_check_media_group_content(
        v_media_group_id,
        p_message_id,
        v_correlation_uuid::text
      );
    END IF;
  END IF;

  -- We have a caption - call parse-caption edge function using pg_net
  -- First, create the HTTP request
  v_request_id := pg_net.http_post(
    url := v_api_url,
    body := jsonb_build_object(
      'messageId', p_message_id::text,
      'caption', v_caption,
      'media_group_id', v_media_group_id,
      'correlationId', v_correlation_uuid::text,
      'force_reprocess', p_force
    )::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_auth_key
    )
  );
  
  -- Wait for the response with a timeout
  FOR i IN 1..30 LOOP -- Try for 30 seconds max
    SELECT * FROM pg_net.http_get_status(v_request_id) INTO v_request_status;
    
    -- Check if request is complete
    IF v_request_status->>'status' = 'complete' THEN
      EXIT;
    END IF;
    
    -- Check if request failed
    IF v_request_status->>'status' = 'error' THEN
      RAISE EXCEPTION 'Edge function request failed: %', v_request_status->>'error_message';
    END IF;
    
    -- Wait before checking again
    PERFORM pg_sleep(1);
  END LOOP;
  
  -- If we exited the loop without a complete status, timeout
  IF v_request_status->>'status' != 'complete' THEN
    RAISE EXCEPTION 'Edge function request timed out after 30 seconds';
  END IF;

  -- Get the response data
  v_http_status := (v_request_status->>'status_code')::int;
  v_http_response := v_request_status->>'response_body';
  
  -- Check if the request was successful
  IF v_http_status < 200 OR v_http_status >= 300 THEN
    RAISE EXCEPTION 'Edge function returned error status: %', v_http_status;
  END IF;

  -- Parse the response body
  v_response := v_http_response::jsonb;
  
  -- Check edge function response
  IF v_response->>'success' = 'false' THEN
    RAISE EXCEPTION 'Edge function failed: %', v_response->>'error';
  END IF;

  -- Extract the parsed content from the response
  v_parse_result := v_response->'parsed_content';
  
  IF v_parse_result IS NULL THEN
    RAISE EXCEPTION 'Edge function returned null parsed_content';
  END IF;

  -- Update message with parsed content
  UPDATE messages
  SET processing_state = 'completed',
      processing_completed_at = NOW(),
      analyzed_content = v_parse_result,
      is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
      updated_at = NOW()
  WHERE id = p_message_id;

  -- If part of media group, sync the parsed content
  IF v_media_group_id IS NOT NULL THEN
    PERFORM xdelo_sync_media_group_content(
      p_message_id,
      v_parse_result,
      true,  -- force_sync
      false  -- sync_edit_history
    );
  END IF;

  -- Log successful completion
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_processing_completed',
    p_message_id,
    v_correlation_uuid::text,
    jsonb_build_object(
      'processor', 'xdelo_process_caption_workflow',
      'end_time', NOW(),
      'success', true,
      'has_media_group', v_media_group_id IS NOT NULL
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'message_id', p_message_id,
    'media_group_id', v_media_group_id,
    'is_media_group', v_media_group_id IS NOT NULL,
    'caption', v_caption,
    'correlation_id', v_correlation_uuid,
    'parsed_content', v_parse_result
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Update to error state
    UPDATE messages
    SET processing_state = 'error',
        error_message = SQLERRM,
        updated_at = NOW()
    WHERE id = p_message_id;

    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      error_message,
      metadata,
      event_timestamp
    ) VALUES (
      'message_processing_error',
      p_message_id,
      v_correlation_uuid::text,
      SQLERRM,
      jsonb_build_object(
        'processor', 'xdelo_process_caption_workflow',
        'error_time', NOW(),
        'error_details', SQLSTATE
      ),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', FALSE,
      'message_id', p_message_id,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset stuck messages for reprocessing
CREATE OR REPLACE FUNCTION public.xdelo_reset_stuck_messages()
RETURNS JSONB AS $$
DECLARE
  v_reset_count INT;
BEGIN
  -- Reset messages stuck in processing state for more than 10 minutes
  UPDATE messages
  SET processing_state = 'pending',
      error_message = 'Reset from stuck processing state',
      updated_at = NOW()
  WHERE processing_state = 'processing'
    AND processing_started_at < NOW() - INTERVAL '10 minutes';
    
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Log the reset operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    event_timestamp
  ) VALUES (
    'system_maintenance',
    gen_random_uuid(),
    jsonb_build_object(
      'action', 'reset_stuck_messages',
      'reset_count', v_reset_count,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'reset_count', v_reset_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reprocess pending messages in batches
CREATE OR REPLACE FUNCTION public.xdelo_process_pending_messages(
  p_batch_size INT DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
  v_message_id UUID;
  v_count INT := 0;
  v_success_count INT := 0;
  v_error_count INT := 0;
  v_result JSONB;
  v_correlation_id UUID := gen_random_uuid();
BEGIN
  -- Process a batch of pending messages
  FOR v_message_id IN 
    SELECT id FROM messages 
    WHERE processing_state = 'pending'
      AND caption IS NOT NULL
      AND caption != ''
    ORDER BY created_at ASC
    LIMIT p_batch_size
  LOOP
    BEGIN
      v_result := xdelo_process_caption_workflow(v_message_id, v_correlation_id::text, TRUE);
      
      IF (v_result->>'success')::BOOLEAN THEN
        v_success_count := v_success_count + 1;
      ELSE
        v_error_count := v_error_count + 1;
      END IF;
      
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_count := v_count + 1;
      
      -- Log the error but continue processing
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
      ) VALUES (
        'batch_processing_error',
        v_message_id,
        v_correlation_id::text,
        SQLERRM,
        jsonb_build_object(
          'processor', 'xdelo_process_pending_messages',
          'error_time', NOW()
        ),
        NOW()
      );
    END;
  END LOOP;
  
  -- Log batch completion
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'batch_processing_completed',
    v_correlation_id,
    v_correlation_id::text,
    jsonb_build_object(
      'processor', 'xdelo_process_pending_messages',
      'completed_at', NOW(),
      'total', v_count,
      'success', v_success_count,
      'errors', v_error_count
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'total_processed', v_count,
    'successful', v_success_count,
    'failed', v_error_count,
    'correlation_id', v_correlation_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger function to call the workflow
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Skip if the message is being deleted
  IF NEW.deleted_from_telegram = TRUE THEN
    RETURN NEW;
  END IF;
  
  -- Skip if caption is empty
  IF NEW.caption IS NULL OR NEW.caption = '' THEN
    RETURN NEW;
  END IF;
  
  -- Call the workflow function with the NEW record's id and correlation_id as text
  PERFORM public.xdelo_process_caption_workflow(NEW.id, NEW.correlation_id::text);
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;
CREATE TRIGGER trg_process_caption
AFTER INSERT OR UPDATE OF caption ON public.messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.caption != '')
EXECUTE FUNCTION xdelo_process_caption_trigger();
