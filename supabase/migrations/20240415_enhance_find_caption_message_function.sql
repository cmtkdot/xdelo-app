
-- Create or replace function to find the best caption message in a media group
CREATE OR REPLACE FUNCTION public.xdelo_find_caption_message(p_media_group_id text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_message_id uuid;
BEGIN
  -- First try to find a message that is explicitly marked as the original caption holder
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND is_original_caption = true
    AND analyzed_content IS NOT NULL
    AND deleted_from_telegram = false
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- Next, try to find a message that has both caption and analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
    AND analyzed_content IS NOT NULL
    AND deleted_from_telegram = false
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- If not found, try to find a message with caption but no analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
    AND deleted_from_telegram = false
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;
  
  -- If still not found, return NULL
  RETURN NULL;
END;
$function$;
