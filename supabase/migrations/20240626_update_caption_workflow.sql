-- Migration to update the caption processing workflow to use edge functions
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(p_message_id uuid, p_correlation_id text DEFAULT NULL::text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_message messages;
  v_caption TEXT;
  v_media_group_id TEXT;
  v_analyzed_content JSONB;
  v_correlation_uuid uuid;
  v_parse_result JSONB;
  v_edge_result JSONB;
  v_edge_function_url TEXT := 'https://xjhhehxcxkiumnwbirel.supabase.co/functions/v1/parse-caption'; -- Adjust if needed for production
BEGIN
  -- Convert correlation_id to UUID if provided, otherwise generate new one
  v_correlation_uuid := CASE
    WHEN p_correlation_id IS NOT NULL THEN
      -- Use a safe cast function or BEGIN/EXCEPTION block if available
      -- Assuming try_cast_uuid exists as per previous feedback context
      public.try_cast_uuid(p_correlation_id, gen_random_uuid())
    ELSE gen_random_uuid()
  END;

  -- Get the message
  SELECT * INTO v_message FROM public.messages WHERE id = p_message_id;

  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Message not found',
      'message_id', p_message_id,
      'correlation_id', v_correlation_uuid -- Include correlation_id in returns
    );
  END IF;

  -- Reset processing state if forced or not already completed/error
  IF p_force OR v_message.processing_state NOT IN ('completed', 'error') THEN
      UPDATE public.messages
      SET processing_state = 'processing',
          processing_started_at = NOW(),
          processing_correlation_id = v_correlation_uuid, -- Store correlation ID
          updated_at = NOW()
      WHERE id = p_message_id;
  ELSE
      -- If already completed/error and not forced, return current state or specific message
      RETURN jsonb_build_object(
          'success', FALSE,
          'message', 'Message already processed or in error state. Use force=true to reprocess.',
          'message_id', p_message_id,
          'current_state', v_message.processing_state,
          'correlation_id', v_correlation_uuid
      );
  END IF;

  -- Log the processing start
  PERFORM public.xdelo_log_processing_event(
    p_message_id,
    'message_processing_started',
    v_correlation_uuid::text,
    jsonb_build_object(
      'processor', 'xdelo_process_caption_workflow',
      'start_time', NOW(),
      'force', p_force
    )
  );

  v_caption := v_message.caption;
  v_media_group_id := v_message.media_group_id;

  -- Check if caption exists
  IF v_caption IS NULL OR v_caption = '' THEN
    -- For messages without caption, keep in processing state (or handle as needed)
    IF v_media_group_id IS NULL THEN
      -- Not part of media group - update state and log
      UPDATE public.messages
      SET processing_state = 'completed', -- Mark as completed since there's nothing to parse
          processing_completed_at = NOW(),
          analyzed_content = jsonb_build_object(
              'caption', '',
              'parsing_metadata', jsonb_build_object(
                  'method', 'empty_caption',
                  'timestamp', NOW(),
                  'correlation_id', v_correlation_uuid
              )
          ),
          updated_at = NOW()
      WHERE id = p_message_id;

      PERFORM public.xdelo_log_processing_event(
          p_message_id,
          'message_processing_completed',
          v_correlation_uuid::text,
          jsonb_build_object('reason', 'Empty caption, no media group')
      );

      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'No caption to process, marked as completed',
        'message_id', p_message_id,
        'correlation_id', v_correlation_uuid
      );
    ELSE
      -- For media group messages without caption, trigger sync check
      -- Assuming xdelo_check_media_group_content handles its own logging/state updates
      RETURN public.xdelo_check_media_group_content(
        v_media_group_id,
        p_message_id,
        v_correlation_uuid::text
      );
    END IF;
  END IF;

  -- We have a caption - call parse-caption edge function
  BEGIN
      SELECT content INTO v_edge_result
      FROM http_post(
        v_edge_function_url,
        jsonb_build_object(
          'messageId', p_message_id::text,
          'caption', v_caption,
          'media_group_id', v_media_group_id,
          'correlationId', v_correlation_uuid::text,
          'force_reprocess', p_force -- Pass force flag to edge function
        )::jsonb,
        'application/json',
        '{}'::jsonb -- Empty headers
      );

  EXCEPTION WHEN OTHERS THEN
      -- Handle HTTP request errors
      PERFORM public.xdelo_log_processing_event(
          p_message_id,
          'edge_function_call_error',
          v_correlation_uuid::text,
          jsonb_build_object('function', 'parse-caption', 'error', SQLERRM)
      );
      UPDATE public.messages SET processing_state = 'error', error_message = 'Edge function HTTP error: ' || SQLERRM, updated_at = NOW() WHERE id = p_message_id;
      RETURN jsonb_build_object('success', FALSE, 'message_id', p_message_id, 'error', 'Edge function HTTP error: ' || SQLERRM, 'correlation_id', v_correlation_uuid);
  END;

  -- Check edge function response validity
  IF v_edge_result IS NULL OR jsonb_typeof(v_edge_result) != 'object' THEN
      PERFORM public.xdelo_log_processing_event(
          p_message_id,
          'edge_function_invalid_response',
          v_correlation_uuid::text,
          jsonb_build_object('function', 'parse-caption', 'response', v_edge_result)
      );
      UPDATE public.messages SET processing_state = 'error', error_message = 'Invalid response from edge function', updated_at = NOW() WHERE id = p_message_id;
      RETURN jsonb_build_object('success', FALSE, 'message_id', p_message_id, 'error', 'Invalid response from edge function', 'correlation_id', v_correlation_uuid);
  END IF;

  -- Check edge function success field
  IF NOT (v_edge_result->>'success')::boolean THEN
      PERFORM public.xdelo_log_processing_event(
          p_message_id,
          'edge_function_processing_error',
          v_correlation_uuid::text,
          jsonb_build_object('function', 'parse-caption', 'response', v_edge_result)
      );
      UPDATE public.messages SET processing_state = 'error', error_message = 'Edge function reported failure: ' || (v_edge_result->>'error'), updated_at = NOW() WHERE id = p_message_id;
      RETURN jsonb_build_object('success', FALSE, 'message_id', p_message_id, 'error', 'Edge function reported failure: ' || (v_edge_result->>'error'), 'correlation_id', v_correlation_uuid);
  END IF;

  -- Extract parsed data (assuming structure {success: true, data: {...}})
  v_parse_result := v_edge_result->'data';

  -- Ensure correlation ID from edge function matches or update if needed (optional)
  -- v_parse_result := jsonb_set(v_parse_result, '{parsing_metadata, correlation_id}', to_jsonb(v_correlation_uuid));

  -- Update message with parsed content from edge function
  UPDATE public.messages
  SET processing_state = 'completed',
      processing_completed_at = NOW(),
      analyzed_content = v_parse_result,
      is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
      updated_at = NOW()
  WHERE id = p_message_id;

   PERFORM public.xdelo_log_processing_event(
      p_message_id,
      'message_processing_completed',
      v_correlation_uuid::text,
      jsonb_build_object('source', 'edge_function', 'result', v_parse_result)
   );

  -- Syncing is now handled *within* the parse-caption edge function if media_group_id is present.
  -- No need to call xdelo_sync_media_group_content here anymore.

  RETURN jsonb_build_object(
    'success', TRUE,
    'message_id', p_message_id,
    'media_group_id', v_media_group_id,
    'is_media_group', v_media_group_id IS NOT NULL,
    'caption', v_caption,
    'correlation_id', v_correlation_uuid,
    'parsed_content', v_parse_result -- Return content received from edge function
  );

EXCEPTION WHEN OTHERS THEN
    -- Generic error handling
    PERFORM public.xdelo_log_processing_event(
        p_message_id,
        'message_processing_error',
        v_correlation_uuid::text,
        jsonb_build_object('processor', 'xdelo_process_caption_workflow', 'error', SQLERRM)
    );
    -- Attempt to update message state to error
    BEGIN
        UPDATE public.messages
        SET processing_state = 'error',
            error_message = SQLERRM,
            updated_at = NOW()
        WHERE id = p_message_id;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore errors during error state update
    END;

    RETURN jsonb_build_object(
      'success', FALSE,
      'message_id', p_message_id,
      'error', SQLERRM,
      'correlation_id', v_correlation_uuid
    );
END;
$function$;
