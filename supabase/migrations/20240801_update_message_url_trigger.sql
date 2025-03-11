
-- Create or update function to construct Telegram message URLs
CREATE OR REPLACE FUNCTION xdelo_construct_telegram_message_url(chat_type telegram_chat_type, chat_id bigint, message_id bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    base_url text := 'https://t.me/';
    processed_chat_id text;
BEGIN
    -- Convert chat_id to text, removing -100 prefix if present
    IF chat_id < -100000000000 THEN
        -- For private channels/groups that start with -100
        processed_chat_id := substring(ABS(chat_id)::text, 3);
    ELSIF chat_id < 0 THEN
        -- For other negative IDs
        processed_chat_id := ABS(chat_id)::text;
    ELSE
        processed_chat_id := chat_id::text;
    END IF;

    -- All chat types now use the same URL format with 'c/'
    RETURN base_url || 'c/' || processed_chat_id || '/' || message_id::text;
END;
$$;

-- Create or replace trigger for updating message_url
CREATE OR REPLACE FUNCTION xdelo_update_other_message_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.message_url := xdelo_construct_telegram_message_url(
    NEW.chat_type,
    NEW.chat_id,
    NEW.telegram_message_id
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS xdelo_trg_update_message_url ON messages;

-- Create new trigger to update message_url on insert/update
CREATE TRIGGER xdelo_trg_update_message_url
BEFORE INSERT OR UPDATE OF chat_id, chat_type, telegram_message_id
ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_update_other_message_url();

-- Also apply the same trigger to other_messages table to maintain consistency
DROP TRIGGER IF EXISTS xdelo_trg_update_other_message_url ON other_messages;

CREATE TRIGGER xdelo_trg_update_other_message_url
BEFORE INSERT OR UPDATE OF chat_id, chat_type, telegram_message_id
ON other_messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_update_other_message_url();
