
-- Remove existing constraints to clean up
DROP INDEX IF EXISTS unique_active_file_in_chat;
DROP INDEX IF EXISTS messages_unique_file_in_chat;
DROP INDEX IF EXISTS idx_messages_forward_lookup;

-- Create a unique index that allows forwards and respects chat context
CREATE UNIQUE INDEX messages_unique_file_in_chat
ON messages (file_unique_id, chat_id)
WHERE deleted_from_telegram = false AND is_forward = false;

-- Add an index to improve forward lookups
CREATE INDEX idx_messages_forward_lookup 
ON messages (file_unique_id, is_forward) 
WHERE deleted_from_telegram = false;

-- Create function to sync forward media
CREATE OR REPLACE FUNCTION public.xdelo_sync_forward_media(p_original_message_id uuid, p_forward_message_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_original_message messages;
BEGIN
  -- Get the original message
  SELECT * INTO v_original_message
  FROM messages
  WHERE id = p_original_message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original message not found';
  END IF;

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
    updated_at = NOW()
  WHERE 
    id = p_forward_message_id;

  -- Log the sync operation
  PERFORM xdelo_log_event(
    'forward_media_synced'::audit_event_type,
    p_forward_message_id,
    NULL,
    NULL,
    NULL,
    jsonb_build_object(
      'original_message_id', p_original_message_id,
      'file_unique_id', v_original_message.file_unique_id
    ),
    jsonb_build_object(
      'sync_source', 'forward_sync',
      'public_url', v_original_message.public_url
    ),
    NULL
  );
END;
$function$;

-- Create trigger to handle forward media syncing
CREATE OR REPLACE FUNCTION public.xdelo_handle_forward_media()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only proceed if this is a forward and we have the original message
  IF NEW.is_forward AND NEW.original_message_id IS NOT NULL THEN
    -- Sync media from original message
    PERFORM xdelo_sync_forward_media(NEW.original_message_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Add trigger for forward media handling
DROP TRIGGER IF EXISTS xdelo_trg_forward_media ON messages;
CREATE TRIGGER xdelo_trg_forward_media
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_handle_forward_media();

-- Create function to sync media group history
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_history()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- When old_analyzed_content changes, sync to media group
  IF NEW.old_analyzed_content IS DISTINCT FROM OLD.old_analyzed_content 
     AND NEW.media_group_id IS NOT NULL THEN
    
    UPDATE messages
    SET old_analyzed_content = NEW.old_analyzed_content,
        edit_history = NEW.edit_history,
        updated_at = NOW()
    WHERE media_group_id = NEW.media_group_id 
    AND id != NEW.id;
    
    -- Log the sync operation
    PERFORM xdelo_log_event(
      'media_group_history_synced'::audit_event_type,
      NEW.id,
      NEW.telegram_message_id,
      NEW.chat_id,
      jsonb_build_object('previous_state', OLD.old_analyzed_content),
      jsonb_build_object('new_state', NEW.old_analyzed_content),
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'sync_type', 'history'
      ),
      NEW.correlation_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Add trigger for media group history syncing
DROP TRIGGER IF EXISTS xdelo_media_group_history_sync ON messages;
CREATE TRIGGER xdelo_media_group_history_sync
  AFTER UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_sync_media_group_history();
