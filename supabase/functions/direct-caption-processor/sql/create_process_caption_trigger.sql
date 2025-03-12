
-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;
DROP FUNCTION IF EXISTS public.xdelo_process_caption_trigger();
DROP FUNCTION IF EXISTS public.xdelo_process_caption_workflow(uuid, uuid, boolean);

-- Create updated workflow function with text parameter for correlation_id
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
  p_message_id uuid,
  p_correlation_id text DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_caption TEXT;
  v_media_group_id TEXT;
  v_analyzed_content JSONB;
  v_correlation_uuid uuid;
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
  
  -- Check if already processed and force not specified
  IF v_message.processing_state = 'completed' AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', FALSE, 
      'message', 'Message already processed',
      'message_id', p_message_id
    );
  END IF;
  
  -- Update to processing state
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
      'caption_length', length(v_message.caption),
      'force', p_force
    ),
    NOW()
  );
  
  v_caption := v_message.caption;
  v_media_group_id := v_message.media_group_id;
  
  -- Check if caption exists
  IF v_caption IS NULL OR v_caption = '' THEN
    -- No caption to process, mark as completed if not part of a media group
    IF v_media_group_id IS NULL THEN
      UPDATE messages
      SET processing_state = 'completed',
          processing_completed_at = NOW(),
          analyzed_content = jsonb_build_object(
            'caption', '',
            'parsing_metadata', jsonb_build_object(
              'method', 'empty_caption',
              'timestamp', NOW()
            )
          ),
          updated_at = NOW()
      WHERE id = p_message_id;
      
      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'No caption to process, marked as completed',
        'message_id', p_message_id
      );
    ELSE
      -- For media group messages without caption, check if we can sync from another message
      RETURN xdelo_check_media_group_content(
        p_media_group_id, 
        p_message_id, 
        v_correlation_uuid::text
      );
    END IF;
  END IF;
  
  -- We have a caption, mark the message for edge function processing
  UPDATE messages
  SET processing_state = 'pending',
      is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
      updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Immediately trigger caption processing by creating an audit log entry
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'caption_ready_for_processing',
    p_message_id,
    v_correlation_uuid::text,
    jsonb_build_object(
      'media_group_id', v_media_group_id,
      'caption', v_caption,
      'immediate_processing', TRUE
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
    'ready_for_processing', TRUE,
    'immediate_trigger', TRUE
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
      'message_id', p_message_id,
      'error', SQLERRM
    );
END;
$$;

-- Create a wrapper function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the workflow function with the NEW record's id and correlation_id as text
  PERFORM public.xdelo_process_caption_workflow(NEW.id, NEW.correlation_id::text);
  RETURN NEW;
END;
$$;

-- Create the actual trigger that calls our wrapper function
CREATE TRIGGER trg_process_caption
  AFTER INSERT OR UPDATE OF caption
  ON public.messages
  FOR EACH ROW
  WHEN (NEW.caption IS NOT NULL AND NEW.caption != '')
  EXECUTE FUNCTION public.xdelo_process_caption_trigger();

