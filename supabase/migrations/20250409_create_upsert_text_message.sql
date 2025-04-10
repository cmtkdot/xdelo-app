-- Migration to create the upsert_text_message function for handling text messages
-- This function follows the same pattern as upsert_media_message but for other_messages table

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
  v_existing_text TEXT;
  v_existing_analyzed_content JSONB;
  v_text_changed BOOLEAN := FALSE;
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
    -- Update existing record with new message details
    IF v_text_changed AND v_existing_analyzed_content IS NOT NULL THEN
      -- If text changed and we have analyzed content, move it to old_analyzed_content
      UPDATE public.other_messages
      SET 
        message_text = p_message_text,
        telegram_data = p_message_data,
        chat_type = v_chat_type,
        chat_title = v_chat_title,
        old_analyzed_content = CASE
          WHEN old_analyzed_content IS NULL THEN jsonb_build_array(analyzed_content)
          ELSE jsonb_insert(old_analyzed_content, '{0}', analyzed_content)
        END,
        analyzed_content = NULL,
        processing_state = p_processing_state::public.processing_state_type,
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
        processing_state = p_processing_state::public.processing_state_type,
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
      p_processing_state::public.processing_state_type,
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

-- Create a migration log entry
INSERT INTO public.unified_audit_logs (
  event_type,
  entity_id,
  correlation_id,
  metadata
) VALUES (
  'schema_migration',
  gen_random_uuid(),
  'system',
  jsonb_build_object(
    'migration_name', '20250409_create_upsert_text_message',
    'description', 'Created upsert_text_message function for text message handling',
    'changelog', 'Created a new function for upserting text messages that handles forward_info consistently'
  )
);
