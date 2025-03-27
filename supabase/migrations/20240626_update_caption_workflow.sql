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
BEGIN
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

  -- We have a caption - call parse-caption edge function
  SELECT content INTO v_edge_result
  FROM http_post(
    'http://localhost:54321/functions/v1/parse-caption',
    jsonb_build_object(
      'messageId', p_message_id::text,
      'caption', v_caption,
      'media_group_id', v_media_group_id,
      'correlationId', v_correlation_uuid::text
    ),
    'application/json'
  );

  -- Check edge function response
  IF v_edge_result->>'success' = 'false' THEN
    RAISE EXCEPTION 'Edge function failed: %', v_edge_result->>'error';
  END IF;

  v_parse_result := v_edge_result->'data';

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
        'error_time', NOW()
      ),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', FALSE,
