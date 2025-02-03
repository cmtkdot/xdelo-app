CREATE OR REPLACE FUNCTION public.init_message_caption()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set is_original_caption based on caption presence
    IF NEW.caption IS NOT NULL AND trim(NEW.caption) != '' THEN
        NEW.is_original_caption := true;
        NEW.processing_state := 'pending'::message_processing_state;
        NEW.group_caption_synced := false;  -- Will be set to true after analysis
    ELSE
        NEW.is_original_caption := false;
        
        -- If part of a media group, check for existing analyzed caption
        IF NEW.media_group_id IS NOT NULL THEN
            DECLARE
                v_caption_message messages%ROWTYPE;
            BEGIN
                -- Look for existing analyzed message in the group
                SELECT * INTO v_caption_message
                FROM messages
                WHERE media_group_id = NEW.media_group_id
                    AND analyzed_content IS NOT NULL
                    AND processing_state = 'completed'::message_processing_state
                LIMIT 1;

                IF v_caption_message.id IS NOT NULL THEN
                    -- Sync with existing analyzed content
                    NEW.message_caption_id := v_caption_message.id;
                    NEW.analyzed_content := v_caption_message.analyzed_content;
                    NEW.processing_state := 'completed'::message_processing_state;
                    NEW.group_caption_synced := true;
                ELSE
                    NEW.processing_state := 'initialized'::message_processing_state;
                    NEW.group_caption_synced := false;
                END IF;
            END;
        ELSE
            NEW.processing_state := 'initialized'::message_processing_state;
            NEW.group_caption_synced := false;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;