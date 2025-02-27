
-- Drop existing deletion trigger and function
DROP TRIGGER IF EXISTS xdelo_trg_message_deletion ON messages;
DROP FUNCTION IF EXISTS xdelo_handle_message_deletion();

-- Add cascade delete constraint for media groups
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS fk_message_caption;

ALTER TABLE messages
ADD CONSTRAINT fk_message_caption 
FOREIGN KEY (message_caption_id) 
REFERENCES messages(id)
ON DELETE CASCADE;

-- Create a simple function to log deleted messages
CREATE OR REPLACE FUNCTION public.xdelo_log_deleted_message()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Store deleted message in deleted_messages table
    INSERT INTO deleted_messages (
        original_message_id,
        telegram_message_id,
        media_group_id,
        message_caption_id,
        caption,
        file_id,
        file_unique_id,
        public_url,
        mime_type,
        analyzed_content,
        telegram_data,
        deleted_from_telegram,
        deleted_via_telegram,
        user_id
    ) VALUES (
        OLD.id,
        OLD.telegram_message_id,
        OLD.media_group_id,
        OLD.message_caption_id,
        OLD.caption,
        OLD.file_id,
        OLD.file_unique_id,
        OLD.public_url,
        OLD.mime_type,
        OLD.analyzed_content,
        OLD.telegram_data,
        OLD.deleted_from_telegram,
        false, -- Not deleted via Telegram
        OLD.user_id
    );
    
    -- Log the deletion event
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        telegram_message_id,
        chat_id,
        previous_state,
        metadata,
        correlation_id,
        user_id
    ) VALUES (
        'message_deleted',
        OLD.id,
        OLD.telegram_message_id,
        OLD.chat_id,
        to_jsonb(OLD),
        jsonb_build_object(
            'media_group_id', OLD.media_group_id,
            'is_original_caption', OLD.is_original_caption,
            'deletion_type', 'database'
        ),
        OLD.correlation_id,
        OLD.user_id
    );

    RETURN OLD;
END;
$function$;

-- Create trigger for logging deleted messages
CREATE TRIGGER xdelo_trg_log_deleted_message
BEFORE DELETE ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_log_deleted_message();

-- Create index to improve performance of cascade deletes
CREATE INDEX IF NOT EXISTS idx_messages_message_caption_id 
ON messages(message_caption_id);

COMMENT ON FUNCTION xdelo_log_deleted_message IS 'Logs deleted messages to deleted_messages table and audit logs';
COMMENT ON CONSTRAINT fk_message_caption ON messages IS 'Cascading delete for media group messages based on caption message';
