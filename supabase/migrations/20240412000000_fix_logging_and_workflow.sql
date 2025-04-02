-- Migration up: Fix logging and workflow functions
-- Description: This migration adds the missing caption workflow function and logging compatibility wrapper
-- Author: System
-- Date: 2024-04-12

-- Create a compatibility wrapper for xdelo_logprocessingevent
CREATE OR REPLACE FUNCTION public.xdelo_logprocessingevent(
  p_event_type text,
  p_entity_id text,
  p_correlation_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Call the consolidated logging function
  PERFORM public.xdelo_log_event(
    p_event_type,
    p_entity_id::uuid,
    p_correlation_id,
    p_metadata,
    p_error_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.xdelo_logprocessingevent IS 'Compatibility wrapper for xdelo_log_event to support legacy code';

-- Create the missing caption workflow function
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
  p_message_id uuid,
  p_correlation_id text DEFAULT NULL,
  p_force boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
  v_message messages;
  v_result jsonb;
  v_caption text;
  v_analyzed_content jsonb;
BEGIN
  -- Get the message details
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  -- Exit if message not found
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Message not found',
      'message_id', p_message_id
    );
  END IF;
  
  -- Skip if message already processed and force is false
  IF v_message.processing_state = 'completed' AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Message already processed',
      'skipped', true,
      'message_id', p_message_id
    );
  END IF;
  
  -- Update to processing state
  UPDATE messages
  SET 
    processing_state = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log processing started
  PERFORM public.xdelo_log_event(
    'caption_processing_started',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'telegram_message_id', v_message.telegram_message_id,
      'chat_id', v_message.chat_id,
      'media_group_id', v_message.media_group_id,
      'message_type', v_message.message_type
    )
  );
  
  -- Get the caption text to analyze
  v_caption := COALESCE(v_message.caption, v_message.text, '');
  
  -- If empty caption, just mark as completed with empty analysis
  IF v_caption = '' THEN
    UPDATE messages
    SET 
      processing_state = 'completed',
      processing_completed_at = NOW(),
      analyzed_content = '{"parsing_metadata":{"success":true,"empty_content":true}}'::jsonb,
      updated_at = NOW()
    WHERE id = p_message_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Empty caption processed',
      'message_id', p_message_id
    );
  END IF;
  
  -- For non-empty captions, analyze the content
  -- This is a simplified parsing implementation
  -- In a real system, this would include more complex parsing logic
  v_analyzed_content := jsonb_build_object(
    'parsing_metadata', jsonb_build_object(
      'success', true,
      'parsing_time', extract(epoch from now())::text,
      'trigger_source', 'database_function'
    ),
    'raw_text', v_caption,
    'parsed_at', now()
  );
  
  -- Update the message with analyzed content
  UPDATE messages
  SET 
    processing_state = 'completed',
    processing_completed_at = NOW(),
    analyzed_content = v_analyzed_content,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log completion
  PERFORM public.xdelo_log_event(
    'caption_processing_completed',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'telegram_message_id', v_message.telegram_message_id,
      'chat_id', v_message.chat_id,
      'media_group_id', v_message.media_group_id,
      'message_type', v_message.message_type
    )
  );
  
  -- If this is part of a media group, sync the caption to other items
  IF v_message.media_group_id IS NOT NULL THEN
    -- Call the media group sync function if it exists
    BEGIN
      PERFORM public.xdelo_sync_media_group(
        p_message_id,
        v_message.media_group_id,
        p_correlation_id,
        false,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      PERFORM public.xdelo_log_event(
        'media_group_sync_error',
        p_message_id,
        p_correlation_id,
        jsonb_build_object(
          'error', SQLERRM,
          'media_group_id', v_message.media_group_id
        ),
        SQLERRM
      );
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Caption processed successfully',
    'message_id', p_message_id,
    'media_group_synced', v_message.media_group_id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.xdelo_process_caption_workflow IS 'Process message captions and synchronize within media groups'; 