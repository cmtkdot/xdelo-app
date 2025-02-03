CREATE OR REPLACE FUNCTION public.manage_processing_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set initial state for new messages
    IF TG_OP = 'INSERT' THEN
        -- For media groups, check if there's already an analyzed caption
        IF NEW.media_group_id IS NOT NULL THEN
            DECLARE
                v_caption_message messages%ROWTYPE;
            BEGIN
                -- Look for existing analyzed message in the group with a valid caption
                SELECT * INTO v_caption_message
                FROM messages
                WHERE media_group_id = NEW.media_group_id
                    AND caption IS NOT NULL
                    AND caption != ''
                    AND trim(caption) != ''
                    AND analyzed_content IS NOT NULL
                LIMIT 1;

                IF v_caption_message.id IS NOT NULL AND (NEW.caption IS NULL OR trim(NEW.caption) = '') THEN
                    -- If we found an analyzed caption and current message has no caption,
                    -- sync with existing analysis
                    NEW.message_caption_id := v_caption_message.id;
                    NEW.analyzed_content := v_caption_message.analyzed_content;
                    NEW.processing_state := 'analysis_synced';
                    NEW.is_original_caption := false;
                ELSIF NEW.caption IS NOT NULL AND trim(NEW.caption) != '' THEN
                    -- This is a message with valid caption
                    NEW.processing_state := 'caption_ready';
                    NEW.is_original_caption := true;
                ELSE
                    -- No valid caption found yet
                    NEW.processing_state := 'initialized';
                    NEW.is_original_caption := false;
                END IF;
            END;
        ELSE
            -- For single messages, only process if caption exists and is not empty
            NEW.processing_state := CASE 
                WHEN NEW.caption IS NOT NULL AND trim(NEW.caption) != '' THEN 'caption_ready'
                ELSE 'initialized'
            END;
        END IF;
    END IF;

    -- Handle updates
    IF TG_OP = 'UPDATE' THEN
        -- If valid caption is added to an initialized message
        IF NEW.caption IS NOT NULL AND trim(NEW.caption) != '' AND 
           (OLD.caption IS NULL OR trim(OLD.caption) = '') AND 
           NEW.processing_state = 'initialized' THEN
            NEW.processing_state := 'caption_ready';
        END IF;

        -- Prevent individual messages in a group from being marked as completed
        -- until the entire group is synced with valid captions
        IF NEW.media_group_id IS NOT NULL AND 
           NEW.processing_state = 'completed' AND 
           OLD.processing_state != 'completed' THEN
            -- Check if all messages in the group are properly synced
            DECLARE
                v_all_synced BOOLEAN;
            BEGIN
                SELECT bool_and(
                    CASE 
                        WHEN caption IS NOT NULL AND trim(caption) != '' THEN group_caption_synced
                        ELSE message_caption_id IS NOT NULL -- For messages without caption, check if they're linked to a caption
                    END
                )
                INTO v_all_synced
                FROM messages
                WHERE media_group_id = NEW.media_group_id;

                IF NOT v_all_synced THEN
                    NEW.processing_state := 'analysis_synced';
                END IF;
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;