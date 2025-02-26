
-- First drop the problematic constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS unique_active_file_in_chat;

-- Drop any existing forward-related constraints
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_file_unique_id_key,
DROP CONSTRAINT IF EXISTS messages_file_unique_id_active_key;

-- Add the correct constraint that allows forwards
ALTER TABLE messages 
ADD CONSTRAINT messages_file_unique_id_active_key 
UNIQUE (file_unique_id, chat_id) 
WHERE deleted_from_telegram = false AND is_forward = false;

-- Add an index to improve forward lookups
CREATE INDEX IF NOT EXISTS idx_messages_forward_lookup 
ON messages (file_unique_id, is_forward) 
WHERE deleted_from_telegram = false;

-- Update the forward handling function to be more robust
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

            -- Copy analyzed content to history
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

-- Create an audit function specifically for forwards
CREATE OR REPLACE FUNCTION public.xdelo_audit_forward_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.is_forward AND OLD.is_forward IS DISTINCT FROM NEW.is_forward THEN
        INSERT INTO unified_audit_logs (
            event_type,
            entity_id,
            telegram_message_id,
            chat_id,
            previous_state,
            new_state,
            metadata,
            correlation_id
        ) VALUES (
            'forward_status_changed'::audit_event_type,
            NEW.id,
            NEW.telegram_message_id,
            NEW.chat_id,
            jsonb_build_object('is_forward', OLD.is_forward),
            jsonb_build_object('is_forward', NEW.is_forward),
            jsonb_build_object(
                'original_message_id', NEW.original_message_id,
                'forward_count', NEW.forward_count
            ),
            NEW.correlation_id
        );
    END IF;
    RETURN NULL;
END;
$function$;

-- Add the audit trigger
DROP TRIGGER IF EXISTS trg_audit_forward_changes ON messages;
CREATE TRIGGER trg_audit_forward_changes
    AFTER UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.is_forward IS DISTINCT FROM NEW.is_forward)
    EXECUTE FUNCTION xdelo_audit_forward_changes();
