
-- Function to handle media sync for forwarded messages
CREATE OR REPLACE FUNCTION public.xdelo_sync_forward_media(
  p_original_message_id uuid,
  p_forward_message_id uuid
)
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

-- Add new trigger to handle forwarded message media sync
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

-- Create trigger for the forward media handler
DROP TRIGGER IF EXISTS xdelo_trg_forward_media ON messages;
CREATE TRIGGER xdelo_trg_forward_media
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.is_forward IS TRUE)
    EXECUTE FUNCTION xdelo_handle_forward_media();

-- Update audit_event_type enum
ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'forward_media_synced';
