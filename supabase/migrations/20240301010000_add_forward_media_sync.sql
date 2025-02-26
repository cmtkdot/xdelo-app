
-- Function to handle media continuity after deletion
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check if any forwarded messages depend on this message's media
  IF EXISTS (
    SELECT 1 FROM messages 
    WHERE original_message_id = OLD.id 
    AND is_forward = true
  ) THEN
    -- If this is the original message and has forwards, find the oldest forward
    -- and make it the new original for remaining forwards
    WITH oldest_forward AS (
      SELECT id
      FROM messages
      WHERE original_message_id = OLD.id
      AND is_forward = true
      ORDER BY created_at ASC
      LIMIT 1
    )
    UPDATE messages
    SET 
      original_message_id = (SELECT id FROM oldest_forward),
      forward_chain = array_append(
        forward_chain,
        jsonb_build_object(
          'previous_original_deleted', true,
          'previous_original_id', OLD.id,
          'new_original_id', (SELECT id FROM oldest_forward),
          'transition_date', CURRENT_TIMESTAMP
        )
      )
    WHERE original_message_id = OLD.id
    AND id != (SELECT id FROM oldest_forward);

    -- Update the new original message
    UPDATE messages
    SET 
      is_forward = false,
      original_message_id = NULL,
      forward_chain = array_append(
        forward_chain,
        jsonb_build_object(
          'became_original', true,
          'previous_original_id', OLD.id,
          'transition_date', CURRENT_TIMESTAMP
        )
      )
    FROM oldest_forward
    WHERE messages.id = oldest_forward.id;
  END IF;

  -- First, backup the message data
  INSERT INTO deleted_messages (
    original_message_id,
    telegram_message_id,
    media_group_id,
    message_caption_id,
    caption,
    file_id,
    file_unique_id,
    public_url,
    mime_type,
    analyzed_content,
    telegram_data,
    deleted_from_telegram,
    deleted_via_telegram,
    user_id,
    had_forwards
  ) VALUES (
    OLD.id,
    OLD.telegram_message_id,
    OLD.media_group_id,
    OLD.message_caption_id,
    OLD.caption,
    OLD.file_id,
    OLD.file_unique_id,
    OLD.public_url,
    OLD.mime_type,
    OLD.analyzed_content,
    OLD.telegram_data,
    OLD.deleted_from_telegram,
    TG_ARGV[0]::text = 'telegram',
    OLD.user_id,
    EXISTS (
      SELECT 1 FROM messages 
      WHERE original_message_id = OLD.id 
      AND is_forward = true
    )
  );

  -- Log the deletion event in the unified audit log
  PERFORM xdelo_log_event(
    'message_deleted'::audit_event_type,
    OLD.id,
    OLD.telegram_message_id,
    OLD.chat_id,
    to_jsonb(OLD),
    NULL,
    jsonb_build_object(
      'deletion_source', TG_ARGV[0],
      'media_group_id', OLD.media_group_id,
      'is_original_caption', OLD.is_original_caption,
      'had_forwards', EXISTS (
        SELECT 1 FROM messages 
        WHERE original_message_id = OLD.id 
        AND is_forward = true
      )
    ),
    OLD.correlation_id,
    OLD.user_id
  );

  RETURN OLD;
END;
$function$;

-- Update deleted_messages table to track forward status
ALTER TABLE deleted_messages
ADD COLUMN IF NOT EXISTS had_forwards boolean DEFAULT false;
