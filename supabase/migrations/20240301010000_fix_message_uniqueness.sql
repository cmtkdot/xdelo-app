
-- Remove existing constraints and indexes that might cause issues
DROP INDEX IF EXISTS unique_active_file_in_chat;
DROP INDEX IF EXISTS messages_unique_file_in_chat;
DROP INDEX IF EXISTS idx_messages_forward_lookup;

-- Create a non-unique index for better lookup performance
CREATE INDEX idx_messages_file_lookup 
ON messages (file_unique_id, chat_id, is_forward) 
WHERE deleted_from_telegram = false;

-- Create function to handle both forwards and caption updates
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If caption changed, this will trigger a re-analysis
    IF NEW.caption != OLD.caption OR (NEW.caption IS NOT NULL AND OLD.caption IS NULL) THEN
        -- Reset analysis state
        NEW.analyzed_content = NULL;
        NEW.processing_state = 'pending';
        NEW.group_caption_synced = false;
        
        -- Add to edit history
        NEW.edit_history = COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
            'edit_date', CURRENT_TIMESTAMP,
            'previous_caption', OLD.caption,
            'new_caption', NEW.caption,
            'is_channel_post', NEW.chat_type = 'channel',
            'previous_analyzed_content', OLD.analyzed_content
        );
        
        -- Log the edit
        PERFORM xdelo_log_event(
            'message_edited'::audit_event_type,
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            jsonb_build_object('caption', OLD.caption, 'analyzed_content', OLD.analyzed_content),
            jsonb_build_object('caption', NEW.caption),
            jsonb_build_object(
                'media_group_id', NEW.media_group_id,
                'is_channel_post', NEW.chat_type = 'channel'
            ),
            NEW.correlation_id
        );
        
        -- If part of media group, update all related messages
        IF NEW.media_group_id IS NOT NULL THEN
            UPDATE messages
            SET 
                analyzed_content = NULL,
                processing_state = 'pending',
                group_caption_synced = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                media_group_id = NEW.media_group_id 
                AND id != NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create function to handle message forwarding without unique constraints
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_forward()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_original_message messages;
    v_forward_data jsonb;
BEGIN
    -- Only proceed if we don't already know it's a forward
    IF NEW.is_forward IS NULL OR NEW.is_forward = false THEN
        -- Look for the original message
        SELECT * INTO v_original_message
        FROM messages
        WHERE file_unique_id = NEW.file_unique_id
        AND id != NEW.id
        AND deleted_from_telegram = false
        ORDER BY created_at ASC
        LIMIT 1;

        IF FOUND THEN
            -- Mark as forwarded
            NEW.is_forward := true;
            NEW.forward_count := COALESCE(v_original_message.forward_count, 0) + 1;
            
            -- Set original message reference
            IF v_original_message.original_message_id IS NOT NULL THEN
                NEW.original_message_id := v_original_message.original_message_id;
            ELSE
                NEW.original_message_id := v_original_message.id;
            END IF;

            -- Create forward history entry
            v_forward_data := jsonb_build_object(
                'forward_date', CURRENT_TIMESTAMP,
                'from_chat_id', NEW.chat_id,
                'from_message_id', NEW.telegram_message_id,
                'previous_message_id', v_original_message.id,
                'forward_count', NEW.forward_count,
                'forward_from', NEW.forward_from,
                'forward_from_chat', NEW.forward_from_chat
            );

            -- Update forward chain
            NEW.forward_chain := array_append(
                COALESCE(v_original_message.forward_chain, ARRAY[]::jsonb[]),
                v_forward_data
            );

            -- Copy analyzed content to history if it exists
            IF v_original_message.analyzed_content IS NOT NULL THEN
                NEW.old_analyzed_content := array_append(
                    COALESCE(v_original_message.old_analyzed_content, ARRAY[]::jsonb[]),
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
                    'forward_count', NEW.forward_count,
                    'forward_from', NEW.forward_from,
                    'forward_from_chat', NEW.forward_from_chat
                ),
                v_forward_data,
                NEW.correlation_id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Ensure triggers are properly set up
DROP TRIGGER IF EXISTS xdelo_trg_message_update ON messages;
CREATE TRIGGER xdelo_trg_message_update
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_handle_message_update();

DROP TRIGGER IF EXISTS xdelo_trg_handle_forward ON messages;
CREATE TRIGGER xdelo_trg_handle_forward
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_handle_message_forward();
