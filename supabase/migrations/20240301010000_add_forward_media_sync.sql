
-- Add media group handling to forward sync
CREATE OR REPLACE FUNCTION public.xdelo_sync_forward_media(
  p_original_message_id uuid,
  p_forward_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_original_message messages;
  v_media_group_id text;
BEGIN
  -- Get the original message
  SELECT * INTO v_original_message
  FROM messages
  WHERE id = p_original_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original message not found';
  END IF;

  -- Store the media group ID
  v_media_group_id := v_original_message.media_group_id;

  -- Update the forwarded message with the original message's media info
  UPDATE messages
  SET 
    file_id = v_original_message.file_id,
    file_unique_id = v_original_message.file_unique_id,
    public_url = v_original_message.public_url,
    mime_type = v_original_message.mime_type,
    file_size = v_original_message.file_size,
    width = v_original_message.width,
    height = v_original_message.height,
    duration = v_original_message.duration,
    media_group_id = v_media_group_id,
    group_caption_synced = v_original_message.group_caption_synced,
    message_caption_id = CASE 
      WHEN v_original_message.is_original_caption THEN p_forward_message_id
      ELSE v_original_message.message_caption_id
    END,
    updated_at = NOW()
  WHERE 
    id = p_forward_message_id;

  -- If this is part of a media group, update all related messages in the forward
  IF v_media_group_id IS NOT NULL THEN
    -- Get all messages from the original media group
    FOR v_original_message IN 
      SELECT * FROM messages 
      WHERE media_group_id = v_media_group_id 
      AND id != p_original_message_id
    LOOP
      -- Create forwarded versions of each media group message
      INSERT INTO messages (
        telegram_message_id,
        chat_id,
        file_id,
        file_unique_id,
        public_url,
        mime_type,
        file_size,
        width,
        height,
        duration,
        media_group_id,
        is_forward,
        original_message_id,
        caption,
        group_caption_synced,
        message_caption_id,
        correlation_id
      ) VALUES (
        NEW.telegram_message_id + v_original_message.telegram_message_id - v_original_message.telegram_message_id,
        NEW.chat_id,
        v_original_message.file_id,
        v_original_message.file_unique_id,
        v_original_message.public_url,
        v_original_message.mime_type,
        v_original_message.file_size,
        v_original_message.width,
        v_original_message.height,
        v_original_message.duration,
        v_media_group_id,
        true,
        v_original_message.id,
        v_original_message.caption,
        true,
        p_forward_message_id,
        gen_random_uuid()
      );
    END LOOP;
  END IF;

  -- Log the sync operation
  PERFORM xdelo_log_event(
    'forward_media_synced'::audit_event_type,
    p_forward_message_id,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'original_message_id', p_original_message_id,
      'file_unique_id', v_original_message.file_unique_id,
      'media_group_id', v_media_group_id
    ),
    jsonb_build_object(
      'sync_source', 'forward_sync',
      'public_url', v_original_message.public_url,
      'is_media_group', v_media_group_id IS NOT NULL
    ),
    NULL
  );
END;
$function$;
