
-- Add new columns for forward information and old analyzed content
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS forward_info jsonb,
ADD COLUMN IF NOT EXISTS old_analyzed_content jsonb[];

-- Add new columns for edit tracking
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_edited_channel_post boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS edit_count integer DEFAULT 0;

-- Create or replace the function to handle message updates
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- When caption changes or this is a channel edit
    IF (NEW.caption != OLD.caption) OR (TG_OP = 'UPDATE' AND NEW.is_edited_channel_post = true) THEN
        -- Store current analyzed_content in old_analyzed_content array
        NEW.old_analyzed_content = array_append(
            COALESCE(OLD.old_analyzed_content, ARRAY[]::jsonb[]),
            OLD.analyzed_content
        );
        
        -- Reset analysis state
        NEW.analyzed_content = NULL;
        NEW.processing_state = 'pending';
        NEW.error_message = NULL;
        NEW.processing_started_at = NULL;
        NEW.processing_completed_at = NULL;
        NEW.group_caption_synced = false;
        
        -- Increment edit count
        NEW.edit_count = COALESCE(OLD.edit_count, 0) + 1;
        
        -- Update edit tracking
        NEW.edit_history = COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
            'edit_date', CURRENT_TIMESTAMP,
            'previous_caption', OLD.caption,
            'new_caption', NEW.caption,
            'is_channel_post', NEW.chat_type = 'channel',
            'previous_analyzed_content', OLD.analyzed_content
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update the message_caption_sync trigger to handle edits
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_analyzed_content()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only proceed if we have analyzed_content and a media_group_id
    IF NEW.analyzed_content IS NOT NULL AND NEW.media_group_id IS NOT NULL THEN
        -- Update all other messages in the same media group
        UPDATE messages
        SET 
            analyzed_content = NEW.analyzed_content,
            processing_state = 'completed',
            group_caption_synced = true,
            message_caption_id = NEW.id,
            updated_at = NOW()
        WHERE 
            media_group_id = NEW.media_group_id 
            AND id != NEW.id;

        -- Log the sync operation
        PERFORM xdelo_log_event(
            'media_group_synced'::audit_event_type,
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            NULL,
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'analyzed_content', NEW.analyzed_content
            ),
            jsonb_build_object(
                'sync_source', 'analyzed_content_trigger',
                'affected_messages', (
                    SELECT json_agg(id) 
                    FROM messages 
                    WHERE media_group_id = NEW.media_group_id 
                    AND id != NEW.id
                )
            ),
            NEW.correlation_id
        );
    END IF;
    
    RETURN NEW;
END;
$function$;
