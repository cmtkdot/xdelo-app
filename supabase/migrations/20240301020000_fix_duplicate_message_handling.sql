
-- First, drop the problematic unique constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS unique_active_file_in_chat;

-- Create or replace the function to handle message updates
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_existing_message messages;
BEGIN
    -- Check for existing active message with same file_unique_id in same chat
    SELECT * INTO v_existing_message
    FROM messages
    WHERE file_unique_id = NEW.file_unique_id 
    AND chat_id = NEW.chat_id
    AND deleted_from_telegram = false
    AND id != NEW.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF FOUND THEN
        -- This is an update to an existing message
        -- Update the existing message instead of creating a new one
        UPDATE messages
        SET 
            caption = NEW.caption,
            analyzed_content = NULL, -- Reset for reanalysis
            processing_state = 'pending',
            group_caption_synced = false,
            updated_at = CURRENT_TIMESTAMP,
            edit_history = COALESCE(edit_history, '[]'::jsonb) || jsonb_build_object(
                'edit_date', CURRENT_TIMESTAMP,
                'previous_caption', caption,
                'new_caption', NEW.caption,
                'is_channel_post', chat_type = 'channel',
                'previous_analyzed_content', analyzed_content
            ),
            edit_count = COALESCE(edit_count, 0) + 1
        WHERE id = v_existing_message.id;

        -- Log the update
        PERFORM xdelo_log_event(
            'message_updated'::audit_event_type,
            v_existing_message.id,
            v_existing_message.telegram_message_id,
            v_existing_message.chat_id,
            jsonb_build_object('previous_caption', v_existing_message.caption),
            jsonb_build_object('new_caption', NEW.caption),
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'update_type', 'duplicate_message_handled'
            ),
            NEW.correlation_id
        );

        -- If part of media group, update related messages
        IF v_existing_message.media_group_id IS NOT NULL THEN
            UPDATE messages
            SET 
                analyzed_content = NULL,
                processing_state = 'pending',
                group_caption_synced = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                media_group_id = v_existing_message.media_group_id 
                AND id != v_existing_message.id;
        END IF;

        -- Signal to skip inserting the new row
        RAISE SQLSTATE '45000' 
            USING MESSAGE = 'Message already exists and was updated',
                  HINT = 'Skip insert';
    END IF;

    RETURN NEW;
END;
$function$;

-- Create or replace the trigger to handle message inserts
DROP TRIGGER IF EXISTS xdelo_trg_handle_message_insert ON messages;
CREATE TRIGGER xdelo_trg_handle_message_insert
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION xdelo_handle_message_update();

-- Update existing index for better performance
DROP INDEX IF EXISTS idx_messages_file_lookup;
CREATE INDEX idx_messages_file_chat_lookup 
ON messages (file_unique_id, chat_id) 
WHERE deleted_from_telegram = false;

-- Add a new function to handle message forwards
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_forward()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_original_message messages;
BEGIN
    -- Only proceed if not already marked as forward
    IF NEW.is_forward IS NULL OR NEW.is_forward = false THEN
        -- Look for any existing message with same file_unique_id
        SELECT * INTO v_original_message
        FROM messages
        WHERE file_unique_id = NEW.file_unique_id
        AND id != NEW.id
        AND deleted_from_telegram = false
        ORDER BY created_at ASC
        LIMIT 1;

        IF FOUND THEN
            -- This is a forward
            NEW.is_forward := true;
            NEW.forward_count := COALESCE(v_original_message.forward_count, 0) + 1;
            NEW.original_message_id := COALESCE(v_original_message.original_message_id, v_original_message.id);
            
            -- Copy analyzed content to history
            IF v_original_message.analyzed_content IS NOT NULL THEN
                NEW.old_analyzed_content := array_append(
                    COALESCE(NEW.old_analyzed_content, ARRAY[]::jsonb[]),
                    v_original_message.analyzed_content
                );
            END IF;

            -- Reset processing state
            NEW.analyzed_content := NULL;
            NEW.processing_state := 'pending';
            NEW.processing_started_at := NULL;
            NEW.processing_completed_at := NULL;
            NEW.group_caption_synced := false;

            -- Log the forward
            PERFORM xdelo_log_event(
                'message_forwarded'::audit_event_type,
                NEW.id,
                NEW.telegram_message_id,
                NEW.chat_id,
                NULL,
                jsonb_build_object(
                    'original_message_id', NEW.original_message_id,
                    'forward_count', NEW.forward_count
                ),
                jsonb_build_object(
                    'from_chat_id', NEW.chat_id,
                    'from_message_id', NEW.telegram_message_id
                ),
                NEW.correlation_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Recreate the forward trigger
DROP TRIGGER IF EXISTS xdelo_trg_handle_forward ON messages;
CREATE TRIGGER xdelo_trg_handle_forward
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION xdelo_handle_message_forward();
