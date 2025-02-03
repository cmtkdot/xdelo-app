CREATE OR REPLACE FUNCTION public.sync_media_group_caption()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed if this is a message with a valid caption in a media group
    IF NEW.media_group_id IS NOT NULL 
       AND NEW.caption IS NOT NULL 
       AND trim(NEW.caption) != '' THEN
        
        -- Update existing messages in the same group that don't have captions
        UPDATE messages
        SET 
            message_caption_id = NEW.id,
            analyzed_content = NEW.analyzed_content,
            processing_state = 'analysis_synced'
        WHERE 
            media_group_id = NEW.media_group_id 
            AND id != NEW.id
            AND (caption IS NULL OR trim(caption) = '')
            AND processing_state = 'initialized';
    END IF;
    RETURN NEW;
END;
$$;