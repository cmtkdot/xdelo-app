
-- Migration to add missing telegram_metadata extraction function
-- This resolves the error: "function xdelo_extract_telegram_metadata(jsonb) does not exist"

-- Create the metadata extraction function that mirrors the JavaScript implementation
CREATE OR REPLACE FUNCTION public.xdelo_extract_telegram_metadata(telegram_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  metadata jsonb;
  message_obj jsonb;
  message_type text;
  media jsonb;
BEGIN
  -- Initialize with update_id if present
  metadata := jsonb_build_object(
    'update_id', telegram_data->'update_id'
  );
  
  -- Determine message type
  IF telegram_data ? 'message' THEN
    message_obj := telegram_data->'message';
    message_type := 'message';
  ELSIF telegram_data ? 'edited_message' THEN
    message_obj := telegram_data->'edited_message';
    message_type := 'edited_message';
  ELSIF telegram_data ? 'channel_post' THEN
    message_obj := telegram_data->'channel_post';
    message_type := 'channel_post';
  ELSIF telegram_data ? 'edited_channel_post' THEN
    message_obj := telegram_data->'edited_channel_post';
    message_type := 'edited_channel_post';
  ELSE
    -- Unknown message type, return minimal data
    RETURN metadata;
  END IF;
  
  -- Add message type to metadata
  metadata := metadata || jsonb_build_object('message_type', message_type);
  
  -- Extract essential message data
  IF message_obj IS NOT NULL THEN
    metadata := metadata || jsonb_build_object(
      'message_id', message_obj->'message_id',
      'date', message_obj->'date',
      'message_thread_id', message_obj->'message_thread_id'
    );
    
    -- Extract chat info
    IF message_obj ? 'chat' THEN
      metadata := metadata || jsonb_build_object(
        'chat', jsonb_build_object(
          'id', message_obj->'chat'->'id',
          'type', message_obj->'chat'->'type',
          'title', message_obj->'chat'->'title',
          'username', message_obj->'chat'->'username'
        )
      );
    END IF;
    
    -- Extract sender info
    IF message_obj ? 'from' THEN
      metadata := metadata || jsonb_build_object(
        'from', jsonb_build_object(
          'id', message_obj->'from'->'id',
          'first_name', message_obj->'from'->'first_name',
          'last_name', message_obj->'from'->'last_name',
          'username', message_obj->'from'->'username',
          'is_bot', message_obj->'from'->'is_bot'
        )
      );
    END IF;
    
    -- Extract forwarded message info
    IF message_obj ? 'forward_date' OR message_obj ? 'forward_from' OR message_obj ? 'forward_from_chat' THEN
      metadata := metadata || jsonb_build_object(
        'forward_info', jsonb_build_object(
          'date', message_obj->'forward_date',
          'from', message_obj->'forward_from',
          'from_chat', CASE 
            WHEN message_obj ? 'forward_from_chat' THEN
              jsonb_build_object(
                'id', message_obj->'forward_from_chat'->'id',
                'type', message_obj->'forward_from_chat'->'type',
                'title', message_obj->'forward_from_chat'->'title'
              )
            ELSE NULL
          END,
          'from_message_id', message_obj->'forward_from_message_id',
          'signature', message_obj->'forward_signature',
          'sender_name', message_obj->'forward_sender_name',
          'origin', message_obj->'forward_origin'
        )
      );
    END IF;
    
    -- Extract basic media info without large binary data
    IF message_obj ? 'photo' AND jsonb_array_length(message_obj->'photo') > 0 THEN
      -- For photo, just keep the largest version's metadata
      media := message_obj->'photo'->-1;
      metadata := metadata || jsonb_build_object(
        'media', jsonb_build_object(
          'type', 'photo',
          'file_id', media->'file_id',
          'file_unique_id', media->'file_unique_id',
          'width', media->'width',
          'height', media->'height',
          'file_size', media->'file_size'
        )
      );
    ELSIF message_obj ? 'video' THEN
      metadata := metadata || jsonb_build_object(
        'media', jsonb_build_object(
          'type', 'video',
          'file_id', message_obj->'video'->'file_id',
          'file_unique_id', message_obj->'video'->'file_unique_id',
          'width', message_obj->'video'->'width',
          'height', message_obj->'video'->'height',
          'duration', message_obj->'video'->'duration',
          'file_size', message_obj->'video'->'file_size',
          'mime_type', message_obj->'video'->'mime_type'
        )
      );
    ELSIF message_obj ? 'document' THEN
      metadata := metadata || jsonb_build_object(
        'media', jsonb_build_object(
          'type', 'document',
          'file_id', message_obj->'document'->'file_id',
          'file_unique_id', message_obj->'document'->'file_unique_id',
          'file_name', message_obj->'document'->'file_name',
          'file_size', message_obj->'document'->'file_size',
          'mime_type', message_obj->'document'->'mime_type'
        )
      );
    END IF;
    
    -- Extract text and caption
    metadata := metadata || jsonb_build_object(
      'text', message_obj->'text',
      'caption', message_obj->'caption',
      'caption_entities', message_obj->'caption_entities',
      'media_group_id', message_obj->'media_group_id'
    );
  END IF;
  
  RETURN metadata;
END;
$function$;

-- Create the necessary function for media group recheck
CREATE OR REPLACE FUNCTION public.xdelo_recheck_media_groups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_media_group_id text;
  v_source_message_id uuid;
  v_analyzed_content jsonb;
BEGIN
  -- Find media groups with mixed analyzing states (some processed, some not)
  FOR v_media_group_id IN
    SELECT DISTINCT media_group_id
    FROM messages
    WHERE media_group_id IS NOT NULL
    GROUP BY media_group_id
    HAVING COUNT(DISTINCT processing_state) > 1
    OR COUNT(*) FILTER (WHERE processing_state = 'error') > 0
    LIMIT 10 -- Process in batches to avoid long transactions
  LOOP
    -- Find a source message in this group that has analyzed content
    SELECT id, analyzed_content INTO v_source_message_id, v_analyzed_content
    FROM messages
    WHERE media_group_id = v_media_group_id
      AND analyzed_content IS NOT NULL
      AND processing_state = 'completed'
    ORDER BY updated_at DESC
    LIMIT 1;
    
    -- If we found a source, use it to sync the group
    IF v_source_message_id IS NOT NULL THEN
      PERFORM xdelo_sync_incomplete_media_group(v_media_group_id, v_source_message_id, v_analyzed_content);
    END IF;
  END LOOP;
END;
$function$;

-- Create helper function for xdelo_recheck_media_groups
CREATE OR REPLACE FUNCTION public.xdelo_sync_incomplete_media_group(
  p_media_group_id text,
  p_source_message_id uuid,
  p_analyzed_content jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Update all other messages in the group that are not completed
  UPDATE messages
  SET analyzed_content = p_analyzed_content,
      processing_state = 'completed',
      processing_completed_at = NOW(),
      updated_at = NOW(),
      error_message = NULL
  WHERE media_group_id = p_media_group_id
    AND id != p_source_message_id
    AND (processing_state != 'completed' OR analyzed_content IS NULL);
    
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata
  ) VALUES (
    'media_group_sync_completed',
    p_media_group_id,
    jsonb_build_object(
      'source_message_id', p_source_message_id,
      'media_group_id', p_media_group_id,
      'sync_method', 'automatic_safety_net'
    )
  );
END;
$function$;

-- Create function to reset stalled messages
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE messages
  SET processing_state = 'pending',
      error_message = 'Reset from stalled processing',
      updated_at = NOW()
  WHERE processing_state = 'processing'
    AND processing_started_at < NOW() - interval '15 minutes'
  RETURNING COUNT(*) INTO v_count;
  
  IF v_count > 0 THEN
    INSERT INTO unified_audit_logs (
      event_type,
      entity_type,
      metadata
    ) VALUES (
      'stalled_messages_reset',
      'system',
      jsonb_build_object(
        'count', v_count,
        'timestamp', NOW()
      )
    );
  END IF;
END;
$function$;

-- Fix the existing trigger so it works with WHEN condition
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;

CREATE TRIGGER trg_process_caption
BEFORE INSERT OR UPDATE OF caption ON public.messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.caption != '')
EXECUTE FUNCTION public.xdelo_set_caption_pending_trigger();

-- Add cron jobs to handle safety net functionality
-- Uncomment these if you're using pg_cron
-- SELECT cron.schedule('*/10 * * * *', 'SELECT public.xdelo_recheck_media_groups()');
-- SELECT cron.schedule('*/5 * * * *', 'SELECT public.xdelo_reset_stalled_messages()');
