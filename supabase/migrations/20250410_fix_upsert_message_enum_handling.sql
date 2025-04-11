
-- Fix the upsert_media_message function to properly handle processing_state enum type
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
    p_user_id bigint DEFAULT NULL::bigint, 
    p_media_group_id text DEFAULT NULL::text, 
    p_forward_info jsonb DEFAULT NULL::jsonb, 
    p_processing_error text DEFAULT NULL::text, 
    p_caption_data jsonb DEFAULT NULL::jsonb,
    p_old_analyzed_content JSONB DEFAULT NULL::JSONB,
    p_analyzed_content jsonb DEFAULT NULL::jsonb
) RETURNS uuid
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
  v_processing_state_enum public.processing_state_type;
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
  
  -- Safely convert processing_state to the correct enum type
  BEGIN
    v_processing_state_enum := p_processing_state::public.processing_state_type;
  EXCEPTION WHEN OTHERS THEN
    -- If casting fails, use a default value
    v_processing_state_enum := 'pending'::public.processing_state_type;
  END;
  
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

  -- Handle existing record (duplicate file_unique_id)
  IF v_message_id IS NOT NULL THEN
    -- Update existing record
    IF v_caption_changed AND v_existing_analyzed_content IS NOT NULL AND p_old_analyzed_content IS NULL THEN
      -- Caption has changed, update the record with the new caption
      -- and reset processing_state to trigger reprocessing if old_analyzed_content not provided
      UPDATE public.messages SET
        telegram_message_id = p_telegram_message_id,
        chat_id = p_chat_id,
        caption = p_caption,
        media_type = p_media_type,
        file_id = p_file_id,
        storage_path = COALESCE(p_storage_path, storage_path),
        public_url = COALESCE(p_public_url, public_url),
        mime_type = COALESCE(p_mime_type, mime_type),
        extension = COALESCE(p_extension, extension),
        message_data = p_message_data,
        processing_state = v_processing_state_enum,
        processing_error = p_processing_error,
        forward_info = p_forward_info,
        caption_data = p_caption_data,
        analyzed_content = p_analyzed_content,
        -- Handle old_analyzed_content - preserve history when caption changes
        old_analyzed_content = CASE 
          WHEN p_old_analyzed_content IS NOT NULL THEN 
            p_old_analyzed_content
          ELSE
            COALESCE(old_analyzed_content, '[]'::jsonb) || jsonb_build_array(v_existing_analyzed_content)
        END,
        correlation_id = p_correlation_id,
        updated_at = NOW(),
        telegram_data = p_message_data
      WHERE id = v_message_id;
    ELSE
      -- No caption change, just update other fields
      UPDATE public.messages SET
        telegram_message_id = p_telegram_message_id,
        chat_id = p_chat_id,
        caption = p_caption,
        media_type = p_media_type,
        file_id = p_file_id,
        storage_path = COALESCE(p_storage_path, storage_path),
        public_url = COALESCE(p_public_url, public_url),
        mime_type = COALESCE(p_mime_type, mime_type),
        extension = COALESCE(p_extension, extension),
        message_data = p_message_data,
        processing_state = v_processing_state_enum,
        processing_error = p_processing_error,
        forward_info = p_forward_info,
        caption_data = p_caption_data,
        analyzed_content = p_analyzed_content,
        -- If old_analyzed_content is explicitly provided, use it
        old_analyzed_content = COALESCE(p_old_analyzed_content, old_analyzed_content),
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
    -- Insert new record
    INSERT INTO public.messages (
      telegram_message_id,
      chat_id,
      chat_type,
      chat_title,
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
      analyzed_content,
      old_analyzed_content,
      correlation_id,
      edit_history,
      telegram_data
    ) VALUES (
      p_telegram_message_id,
      p_chat_id,
      v_chat_type,
      v_chat_title,
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
      v_processing_state_enum,
      p_processing_error,
      p_forward_info,
      p_media_group_id,
      p_caption_data,
      COALESCE(p_analyzed_content, p_caption_data),
      p_old_analyzed_content,
      p_correlation_id,
      '[]'::jsonb,
      p_message_data
    )
    RETURNING id INTO v_message_id;
  END IF;
  
  RETURN v_message_id;
END;
$function$;

-- Fix the upsert_text_message function to properly handle processing_state enum type
CREATE OR REPLACE FUNCTION public.upsert_text_message(
    p_telegram_message_id bigint, 
    p_chat_id bigint, 
    p_message_text text, 
    p_message_data jsonb, 
    p_correlation_id text, 
    p_chat_type text DEFAULT NULL::text, 
    p_chat_title text DEFAULT NULL::text, 
    p_forward_info jsonb DEFAULT NULL::jsonb, 
    p_processing_state text DEFAULT 'pending_analysis'::text, 
    p_processing_error text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql
AS $function$
DECLARE
  v_message_id UUID;
  v_message_date TIMESTAMPTZ;
  v_raw_chat_type TEXT;
  v_chat_type public.telegram_chat_type;
  v_chat_title TEXT;
  v_existing_text TEXT;
  v_existing_analyzed_content JSONB;
  v_text_changed BOOLEAN := FALSE;
  v_processing_state public.processing_state_type;
BEGIN
  -- Extract message date from message_data
  v_message_date := to_timestamp((p_message_data->>'date')::numeric);
  v_raw_chat_type := COALESCE(p_chat_type, p_message_data->'chat'->>'type');
  v_chat_title := COALESCE(p_chat_title, p_message_data->'chat'->>'title');
  
  -- Validate chat type - make sure it's one of the allowed enum values
  CASE lower(v_raw_chat_type)
    WHEN 'private' THEN v_chat_type := 'private'::public.telegram_chat_type;
    WHEN 'group' THEN v_chat_type := 'group'::public.telegram_chat_type;
    WHEN 'supergroup' THEN v_chat_type := 'supergroup'::public.telegram_chat_type;
    WHEN 'channel' THEN v_chat_type := 'channel'::public.telegram_chat_type;
    ELSE v_chat_type := 'unknown'::public.telegram_chat_type;
  END CASE;
  
  -- Safely convert processing_state to the correct enum type
  BEGIN
    -- Try to cast the string to the enum type
    v_processing_state := p_processing_state::public.processing_state_type;
  EXCEPTION WHEN OTHERS THEN
    -- If casting fails, use 'pending' as fallback
    v_processing_state := 'pending'::public.processing_state_type;
  END;
  
  -- Check if a message with this telegram_message_id and chat_id already exists
  SELECT 
    id,
    message_text,
    analyzed_content
  INTO 
    v_message_id,
    v_existing_text,
    v_existing_analyzed_content
  FROM public.other_messages
  WHERE telegram_message_id = p_telegram_message_id
    AND chat_id = p_chat_id;
    
  -- Check if text has changed
  IF v_message_id IS NOT NULL AND 
     v_existing_text IS NOT NULL AND 
     p_message_text IS NOT NULL AND 
     v_existing_text != p_message_text THEN
    v_text_changed := TRUE;
  END IF;
  
  -- Update or insert the record
  IF v_message_id IS NOT NULL THEN
    -- Update existing record
    IF v_text_changed THEN
      -- Handle text change - preserve old analyzed content
      UPDATE public.other_messages
      SET 
        message_text = p_message_text,
        telegram_data = p_message_data,
        chat_type = v_chat_type,
        chat_title = v_chat_title, 
        processing_state = v_processing_state,  -- Using properly cast enum value
        processing_error = p_processing_error,
        forward_info = p_forward_info,
        correlation_id = p_correlation_id,
        updated_at = NOW(),
        is_edited = TRUE,
        edit_count = COALESCE(edit_count, 0) + 1,
        last_edited_at = NOW()
      WHERE id = v_message_id;
    ELSE
      -- Normal update without text changes
      UPDATE public.other_messages
      SET 
        message_text = p_message_text,
        telegram_data = p_message_data,
        chat_type = v_chat_type,
        chat_title = v_chat_title,
        processing_state = v_processing_state,  -- Using properly cast enum value
        processing_error = p_processing_error,
        forward_info = p_forward_info,
        correlation_id = p_correlation_id,
        updated_at = NOW()
      WHERE id = v_message_id;
    END IF;
    
    -- Log the duplicate handling
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      metadata
    ) VALUES (
      'text_message_duplicate_handled',
      v_message_id,
      p_correlation_id,
      jsonb_build_object(
        'telegram_message_id', p_telegram_message_id,
        'chat_id', p_chat_id,
        'text_changed', v_text_changed
      )
    );
    
  ELSE
    -- Insert new record
    INSERT INTO public.other_messages (
      telegram_message_id,
      chat_id,
      chat_type,
      chat_title,
      message_date,
      message_type,
      message_text,
      telegram_data,
      processing_state,
      processing_error,
      forward_info,
      correlation_id,
      edit_history,
      is_edited,
      edit_count
    ) VALUES (
      p_telegram_message_id,
      p_chat_id,
      v_chat_type,
      v_chat_title,
      v_message_date,
      'text',
      p_message_text,
      p_message_data,
      v_processing_state,  -- Using properly cast enum value
      p_processing_error,
      p_forward_info,
      p_correlation_id,
      '[]'::jsonb,
      FALSE,
      0
    )
    RETURNING id INTO v_message_id;
  END IF;
  
  RETURN v_message_id;
END;
$function$;
