
-- Fix the JSONB/JSONB[] type mismatch in upsert_media_message function
-- This migration simplifies the handling of old_analyzed_content

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
    p_old_analyzed_content jsonb DEFAULT NULL::jsonb,
    p_analyzed_content jsonb DEFAULT NULL::jsonb
) RETURNS UUID
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
      -- Simplified: For caption changes, move current analyzed_content to old_analyzed_content
      old_analyzed_content = CASE 
        WHEN v_caption_changed AND v_existing_analyzed_content IS NOT NULL THEN 
          v_existing_analyzed_content 
        ELSE 
          COALESCE(p_old_analyzed_content, old_analyzed_content)
      END,
      -- Use new analyzed_content if provided, else keep existing
      analyzed_content = CASE
        WHEN v_caption_changed THEN p_analyzed_content
        ELSE COALESCE(p_analyzed_content, analyzed_content)
      END,
      correlation_id = p_correlation_id,
      updated_at = NOW(),
      telegram_data = p_message_data
    WHERE id = v_message_id;
    
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
      p_analyzed_content,
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

-- Add migration tracking
INSERT INTO migration_history (version, name, applied_at, description)
VALUES (
    '14.0',
    'fix-jsonb-array-issue',
    NOW(),
    'Fixed JSONB/JSONB[] type mismatch in upsert_media_message function'
);
