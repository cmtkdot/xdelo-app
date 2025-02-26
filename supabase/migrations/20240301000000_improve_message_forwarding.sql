-- Add new columns for tracking forwards and message history
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS forward_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS original_message_id uuid,
ADD COLUMN IF NOT EXISTS forward_chain jsonb[] DEFAULT ARRAY[]::jsonb[],
ADD COLUMN IF NOT EXISTS is_forward boolean DEFAULT false;

-- Drop existing unique constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_file_unique_id_key;

-- Add new partial unique constraint that excludes deleted messages
ALTER TABLE messages 
ADD CONSTRAINT messages_file_unique_id_active_key 
UNIQUE (file_unique_id) 
WHERE deleted_from_telegram = false AND is_forward = false;

-- Create or replace function to handle message forwards
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_forward()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_original_message messages;
    v_forward_data jsonb;
BEGIN
    -- Check for existing message with same file_unique_id
    SELECT * INTO v_original_message
    FROM messages
    WHERE file_unique_id = NEW.file_unique_id
    AND id != NEW.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF FOUND THEN
        -- This is a forwarded message
        NEW.is_forward := true;
        NEW.forward_count := COALESCE(v_original_message.forward_count, 0) + 1;
        NEW.original_message_id := v_original_message.original_message_id;

        -- If no original_message_id, this is first forward of original
        IF NEW.original_message_id IS NULL THEN
            NEW.original_message_id := v_original_message.id;
        END IF;

        -- Create forward history entry
        v_forward_data := jsonb_build_object(
            'forward_date', CURRENT_TIMESTAMP,
            'from_chat_id', NEW.chat_id,
            'from_message_id', NEW.telegram_message_id,
            'previous_message_id', v_original_message.id,
            'forward_count', NEW.forward_count
        );

        -- Add to forward chain
        NEW.forward_chain := COALESCE(v_original_message.forward_chain, ARRAY[]::jsonb[]);
        NEW.forward_chain := array_append(NEW.forward_chain, v_forward_data);

        -- Copy analyzed content to history if it exists
        IF v_original_message.analyzed_content IS NOT NULL THEN
            NEW.old_analyzed_content := array_append(
                COALESCE(v_original_message.old_analyzed_content, ARRAY[]::jsonb[]),
                v_original_message.analyzed_content
            );
        END IF;

        -- Reset processing state for new analysis
        NEW.analyzed_content := NULL;
        NEW.processing_state := 'pending';
        NEW.processing_started_at := NULL;
        NEW.processing_completed_at := NULL;
        NEW.group_caption_synced := false;

        -- Log the forward event
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
            v_forward_data,
            NEW.correlation_id
        );
    END IF;

    RETURN NEW;
END;
$function$;

-- Create trigger for handling forwards
DROP TRIGGER IF EXISTS xdelo_trg_handle_forward ON messages;
CREATE TRIGGER xdelo_trg_handle_forward
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION xdelo_handle_message_forward();

-- Create view for forward history
CREATE OR REPLACE VIEW v_message_forwards AS
SELECT 
    m.id,
    m.file_unique_id,
    m.telegram_message_id,
    m.chat_id,
    m.original_message_id,
    m.forward_count,
    m.forward_chain,
    m.analyzed_content,
    m.old_analyzed_content,
    m.processing_state,
    m.created_at,
    om.telegram_message_id as original_telegram_message_id,
    om.chat_id as original_chat_id,
    om.analyzed_content as original_analyzed_content
FROM messages m
LEFT JOIN messages om ON m.original_message_id = om.id
WHERE m.is_forward = true
ORDER BY m.created_at DESC;

-- Update the message update trigger to handle forwards properly
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- When caption changes or this is a channel edit
    IF (NEW.caption != OLD.caption) OR (TG_OP = 'UPDATE' AND NEW.is_edited_channel_post = true) THEN
        -- Store current analyzed_content in old_analyzed_content array
        NEW.old_analyzed_content := array_append(
            COALESCE(OLD.old_analyzed_content, ARRAY[]::jsonb[]),
            OLD.analyzed_content
        );
        
        -- Reset analysis state
        NEW.analyzed_content := NULL;
        NEW.processing_state := 'pending';
        NEW.error_message := NULL;
        NEW.processing_started_at := NULL;
        NEW.processing_completed_at := NULL;
        NEW.group_caption_synced := false;
        
        -- Increment edit count
        NEW.edit_count := COALESCE(OLD.edit_count, 0) + 1;
        
        -- Update edit tracking
        NEW.edit_history := COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
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

-- Create function to get forward history
CREATE OR REPLACE FUNCTION public.xdelo_get_message_forward_history(p_message_id uuid)
RETURNS TABLE (
    message_id uuid,
    telegram_message_id bigint,
    chat_id bigint,
    forward_date timestamp with time zone,
    analyzed_content jsonb,
    forward_count integer
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE forward_tree AS (
        -- Base case: get the original message
        SELECT 
            m.id,
            m.telegram_message_id,
            m.chat_id,
            m.created_at as forward_date,
            m.analyzed_content,
            m.forward_count,
            m.forward_chain
        FROM messages m
        WHERE m.id = p_message_id

        UNION ALL

        -- Recursive case: get all forwards
        SELECT 
            m.id,
            m.telegram_message_id,
            m.chat_id,
            m.created_at as forward_date,
            m.analyzed_content,
            m.forward_count,
            m.forward_chain
        FROM messages m
        INNER JOIN forward_tree ft ON m.original_message_id = ft.id
        WHERE m.is_forward = true
    )
    SELECT 
        id,
        telegram_message_id,
        chat_id,
        forward_date,
        analyzed_content,
        forward_count
    FROM forward_tree
    ORDER BY forward_date DESC;
END;
$function$;
