
-- Start transaction
BEGIN;

-- Create a consolidated function to handle message updates from webhooks
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update(p_message jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id text := gen_random_uuid()::text;
  v_message_id uuid;
  v_media_group_id text;
  v_caption text;
  v_result jsonb;
  v_processing_state text;
BEGIN
  -- Extract important fields from the message
  v_message_id := (p_message->>'id')::uuid;
  v_media_group_id := p_message->>'media_group_id';
  v_caption := p_message->>'caption';
  
  -- Determine processing state based on message content
  v_processing_state := CASE
    WHEN v_caption IS NULL OR v_caption = '' THEN 'pending'
    ELSE 'initialized'
  END;
  
  -- Check if message exists
  IF EXISTS (SELECT 1 FROM messages WHERE id = v_message_id) THEN
    -- Update existing message
    UPDATE messages
    SET
      caption = v_caption,
      media_group_id = v_media_group_id,
      updated_at = NOW(),
      correlation_id = v_correlation_id,
      processing_state = CASE
        WHEN analyzed_content IS NOT NULL THEN 'completed'
        ELSE v_processing_state
      END
    WHERE id = v_message_id
    RETURNING id INTO v_message_id;
    
    -- Log the update
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      event_timestamp
    ) VALUES (
      'message_updated',
      v_message_id,
      v_correlation_id,
      jsonb_build_object(
        'updated_fields', jsonb_build_object(
          'caption', v_caption IS NOT NULL,
          'media_group_id', v_media_group_id IS NOT NULL
        ),
        'media_group_id', v_media_group_id
      ),
      NOW()
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Message updated',
      'message_id', v_message_id,
      'correlation_id', v_correlation_id
    );
  ELSE
    -- Insert new message
    INSERT INTO messages (
      id,
      caption,
      media_group_id,
      correlation_id,
      processing_state,
      created_at,
      updated_at
    ) VALUES (
      v_message_id,
      v_caption,
      v_media_group_id,
      v_correlation_id,
      v_processing_state,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_message_id;
    
    -- Log the creation
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata,
      event_timestamp
    ) VALUES (
      'message_created',
      v_message_id,
      v_correlation_id,
      jsonb_build_object(
        'has_caption', v_caption IS NOT NULL,
        'media_group_id', v_media_group_id,
        'processing_state', v_processing_state
      ),
      NOW()
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'message', 'Message created',
      'message_id', v_message_id,
      'correlation_id', v_correlation_id
    );
  END IF;
  
  -- If message is part of a media group, check if it can inherit content
  IF v_media_group_id IS NOT NULL AND v_caption IS NULL THEN
    PERFORM xdelo_check_media_group_content(
      v_media_group_id,
      v_message_id,
      v_correlation_id
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Commit transaction
COMMIT;
