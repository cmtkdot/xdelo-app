-- Update upsert_media_message function to handle old_analyzed_content as JSONB not JSONB[]
DROP FUNCTION IF EXISTS public.upsert_media_message;

CREATE OR REPLACE FUNCTION public.upsert_media_message(
    p_telegram_message_id bigint,
    p_chat_id bigint,
    p_file_unique_id text,
    p_file_id text,
    p_public_url text,
    p_storage_path text,
    p_media_type text,
    p_mime_type text,
    p_extension text,
    p_caption text DEFAULT NULL::text,
    p_media_group_id text DEFAULT NULL::text,
    p_message_data jsonb DEFAULT NULL::jsonb,
    p_processing_state text DEFAULT 'initialized'::text,
    p_is_edited boolean DEFAULT false,
    p_forward_info jsonb DEFAULT NULL::jsonb,
    p_analyzed_content jsonb DEFAULT NULL::jsonb,
    p_old_analyzed_content jsonb DEFAULT NULL::jsonb,  -- Changed from jsonb[] to jsonb
    p_additional_updates jsonb DEFAULT NULL::jsonb
) RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
AS $function$
DECLARE
    v_id uuid;
    v_existing_message_id uuid;
    v_existing_caption text;
    v_existing_analyzed_content jsonb;
    v_caption_changed boolean := false;
    v_update_fields jsonb := p_additional_updates;
BEGIN
    -- First, try to find an existing message with the same file_unique_id
    SELECT id, caption, analyzed_content INTO v_existing_message_id, v_existing_caption, v_existing_analyzed_content
    FROM public.messages
    WHERE file_unique_id = p_file_unique_id
    LIMIT 1;
    
    -- Check if caption has changed
    IF v_existing_message_id IS NOT NULL AND p_caption IS NOT NULL AND v_existing_caption IS DISTINCT FROM p_caption THEN
        v_caption_changed := true;
        
        -- Prepare update fields for caption change
        IF v_update_fields IS NULL THEN
            v_update_fields := '{}'::jsonb;
        END IF;
        
        -- Set old_analyzed_content to the current analyzed_content (as a single JSONB object)
        -- This overwrites any previous old_analyzed_content value
        v_update_fields := v_update_fields || jsonb_build_object(
            'old_analyzed_content', v_existing_analyzed_content,
            'processing_state', 'initialized'
        );
    END IF;
    
    -- If file_unique_id exists, update the record
    IF v_existing_message_id IS NOT NULL THEN
        UPDATE public.messages
        SET 
            telegram_message_id = p_telegram_message_id,
            chat_id = p_chat_id,
            file_id = COALESCE(p_file_id, file_id),
            public_url = COALESCE(p_public_url, public_url),
            storage_path = COALESCE(p_storage_path, storage_path),
            media_type = COALESCE(p_media_type, media_type),
            mime_type = COALESCE(p_mime_type, mime_type),
            extension = COALESCE(p_extension, extension),
            caption = COALESCE(p_caption, caption),
            media_group_id = COALESCE(p_media_group_id, media_group_id),
            message_data = COALESCE(p_message_data, message_data),
            processing_state = CASE 
                WHEN v_caption_changed THEN 'initialized'
                ELSE COALESCE(p_processing_state, processing_state)
            END,
            is_edited = COALESCE(p_is_edited, is_edited),
            forward_info = COALESCE(p_forward_info, forward_info),
            analyzed_content = CASE 
                WHEN p_analyzed_content IS NOT NULL THEN p_analyzed_content
                ELSE analyzed_content
            END,
            old_analyzed_content = CASE 
                WHEN v_update_fields->>'old_analyzed_content' IS NOT NULL THEN (v_update_fields->>'old_analyzed_content')::jsonb
                WHEN p_old_analyzed_content IS NOT NULL THEN p_old_analyzed_content
                ELSE old_analyzed_content
            END,
            updated_at = NOW()
        WHERE id = v_existing_message_id;
        
        v_id := v_existing_message_id;
    ELSE
        -- Insert a new record
        INSERT INTO public.messages(
            telegram_message_id,
            chat_id,
            file_unique_id,
            file_id,
            public_url,
            storage_path,
            media_type,
            mime_type,
            extension,
            caption,
            media_group_id,
            message_data,
            processing_state,
            is_edited,
            forward_info,
            analyzed_content,
            old_analyzed_content
        )
        VALUES(
            p_telegram_message_id,
            p_chat_id,
            p_file_unique_id,
            p_file_id,
            p_public_url,
            p_storage_path,
            p_media_type,
            p_mime_type,
            p_extension,
            p_caption,
            p_media_group_id,
            p_message_data,
            p_processing_state,
            p_is_edited,
            p_forward_info,
            p_analyzed_content,
            p_old_analyzed_content  -- This will now be a single JSONB, not an array
        )
        RETURNING id INTO v_id;
    END IF;
    
    -- If media_group_id is provided and caption changed, update all messages in the group
    IF v_caption_changed AND p_media_group_id IS NOT NULL THEN
        UPDATE public.messages
        SET 
            caption = p_caption,
            processing_state = 'initialized',
            old_analyzed_content = v_existing_analyzed_content, -- Store as single JSONB, not array
            updated_at = NOW()
        WHERE 
            media_group_id = p_media_group_id 
            AND id != v_existing_message_id;
    END IF;
    
    RETURN v_id;
END;
$function$;

-- Add documentation comment to function
COMMENT ON FUNCTION public.upsert_media_message IS 'Upserts a media message into the messages table. Handles old_analyzed_content as a single JSONB object that stores the previous analyzed_content when a caption changes. The previous value is always overwritten, not appended to an array.';
