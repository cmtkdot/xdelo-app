-- Migration to remove references to user_id in the upsert_media_message function
-- Since we don't need user_id in the messages table, we'll ignore this parameter in the function

CREATE OR REPLACE FUNCTION public.upsert_media_message(
  p_telegram_message_id bigint, 
  p_chat_id bigint, 
  p_file_unique_id text, 
  p_file_id text, 
  p_storage_path text, 
  p_public_url text, 
  p_mime_type text, 
  p_extension text, 
  p_media_type text, 
  p_caption text, 
  p_processing_state text, 
  p_message_data jsonb, 
  p_correlation_id text, 
  p_user_id bigint DEFAULT NULL::bigint, -- Keep parameter for backward compatibility but ignore it
  p_media_group_id text DEFAULT NULL::text, 
  p_forward_info jsonb DEFAULT NULL::jsonb, 
  p_processing_error text DEFAULT NULL::text, 
  p_caption_data jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_message_id UUID;
  v_message_date TIMESTAMPTZ;
  v_raw_chat_type TEXT;
  v_chat_type public.telegram_chat_type;
  v_chat_title TEXT;
  v_existing_caption TEXT;
  v_existing_analyzed_content JSONB;
  v_caption_changed BOOLEAN := FALSE;
  v_media_group_record RECORD;
BEGIN
  -- Extract message date from message_data
  v_message_date := to_timestamp((p_message_data->>'date')::numeric);
  v_raw_chat_type := p_message_data->'chat'->>'type';
  v_chat_title := p_message_data->'chat'->>'title';
  
  -- Validate chat type - make sure it's one of the allowed enum values
  CASE lower(v_raw_chat_type)
    WHEN 'private' THEN v_chat_type := 'private'::public.telegram_chat_type;
    WHEN 'group' THEN v_chat_type := 'group'::public.telegram_chat_type;
    WHEN 'supergroup' THEN v_chat_type := 'supergroup'::public.telegram_chat_type;
    WHEN 'channel' THEN v_chat_type := 'channel'::public.telegram_chat_type;
    ELSE v_chat_type := 'unknown'::public.telegram_chat_type;
  END CASE;
  
  -- Check if a message with this file_unique_id already exists
  SELECT 
    id, 
    caption, 
    analyzed_content 
  INTO 
    v_message_id, 
    v_existing_caption, 
    v_existing_analyzed_content
  FROM public.messages
  WHERE file_unique_id = p_file_unique_id;
  
  -- Check if caption has changed
  IF v_message_id IS NOT NULL AND 
     v_existing_caption IS NOT NULL AND 
     p_caption IS NOT NULL AND 
     v_existing_caption != p_caption THEN
    v_caption_changed := TRUE;
  END IF;
  
  IF v_message_id IS NOT NULL THEN
    -- Update existing record with new message details
    IF v_caption_changed AND v_existing_analyzed_content IS NOT NULL THEN
      -- If caption changed and we have analyzed content, move it to old_analyzed_content
      UPDATE public.messages
      SET 
        telegram_message_id = p_telegram_message_id,
        chat_id = p_chat_id,
        chat_type = v_chat_type,
        chat_title = v_chat_title,
        -- user_id = p_user_id, -- Removed user_id assignment
        caption = p_caption,
        media_type = p_media_type,
        file_id = p_file_id,
        file_unique_id = p_file_unique_id,
        storage_path = p_storage_path,
        public_url = p_public_url,
        mime_type = p_mime_type,
        extension = p_extension,
        message_data = p_message_data,
        old_analyzed_content = CASE 
          WHEN old_analyzed_content IS NULL THEN jsonb_build_array(analyzed_content)
          ELSE jsonb_insert(old_analyzed_content, '{0}', analyzed_content)
        END,
        analyzed_content = NULL,
        processing_state = p_processing_state::public.processing_state_type,
        processing_error = p_processing_error,
        forward_info = p_forward_info,
        media_group_id = p_media_group_id,
        caption_data = p_caption_data,
        correlation_id = p_correlation_id,
        updated_at = NOW(),
        telegram_data = p_message_data
      WHERE id = v_message_id;
    ELSE
      -- Normal update without caption changes
      UPDATE public.messages
      SET 
        telegram_message_id = p_telegram_message_id,
        chat_id = p_chat_id,
        chat_type = v_chat_type,
        chat_title = v_chat_title,
        -- user_id = p_user_id, -- Removed user_id assignment
        caption = p_caption,
        media_type = p_media_type,
        file_id = p_file_id,
        file_unique_id = p_file_unique_id,
        storage_path = p_storage_path,
        public_url = p_public_url,
        mime_type = p_mime_type,
        extension = p_extension,
        message_data = p_message_data,
        processing_state = p_processing_state::public.processing_state_type,
        processing_error = p_processing_error,
        forward_info = p_forward_info,
        caption_data = p_caption_data,
        correlation_id = p_correlation_id,
        updated_at = NOW(),
        telegram_data = p_message_data
      WHERE id = v_message_id;
    END IF;
    
    -- Log the duplicate handling
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata
    ) VALUES (
      'media_message_duplicate_handled',
      v_message_id,
      p_correlation_id,
      jsonb_build_object(
        'file_unique_id', p_file_unique_id,
        'telegram_message_id', p_telegram_message_id,
        'chat_id', p_chat_id,
        'caption_changed', v_caption_changed
      )
    );
    
  ELSE
    -- Insert new record without user_id
    INSERT INTO public.messages (
      telegram_message_id,
      chat_id,
      chat_type,
      chat_title,
      -- user_id, -- Removed user_id from fields
      message_date,
      caption,
      media_type,
      file_id,
      file_unique_id,
      storage_path,
      public_url,
      mime_type,
      extension,
      message_data,
      processing_state,
      processing_error,
      forward_info,
      media_group_id,
      caption_data,
      correlation_id,
      edit_history,
      telegram_data
    ) VALUES (
      p_telegram_message_id,
      p_chat_id,
      v_chat_type,
      v_chat_title,
      -- p_user_id, -- Removed user_id from values
      v_message_date,
      p_caption,
      p_media_type,
      p_file_id,
      p_file_unique_id,
      p_storage_path,
      p_public_url,
      p_mime_type,
      p_extension,
      p_message_data,
      p_processing_state::public.processing_state_type,
      p_processing_error,
      p_forward_info,
      p_media_group_id,
      p_caption_data,
      p_correlation_id,
      '[]'::jsonb,
      p_message_data
    )
    RETURNING id INTO v_message_id;
  END IF;
  
  RETURN v_message_id;
END;
$function$;

-- Create a migration log entry
INSERT INTO public.unified_audit_logs (
  event_type,
  correlation_id,
  message,
  metadata
) VALUES (
  'schema_migration',
  'system',
  'Removed user_id field usage from upsert_media_message',
  jsonb_build_object(
    'migration_name', '20250409_remove_user_id_usage',
    'reason', 'Type mismatch between application (bigint) and database (uuid)'
  )
);
