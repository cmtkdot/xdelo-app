
-- Create or replace the message URL construction function
CREATE OR REPLACE FUNCTION xdelo_construct_telegram_message_url(chat_type text, chat_id bigint, message_id bigint)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    base_url text := 'https://t.me/';
    processed_chat_id text;
    inferred_chat_type text;
BEGIN
    -- Infer chat type from chat_id pattern if not provided or unknown
    IF chat_type IS NULL OR chat_type = 'unknown' THEN
        IF chat_id > 0 THEN
            inferred_chat_type := 'private';
        ELSIF chat_id < -100000000000 THEN
            inferred_chat_type := 'supergroup_or_channel';
        ELSIF chat_id < 0 THEN
            inferred_chat_type := 'group';
        ELSE
            inferred_chat_type := 'unknown';
        END IF;
    ELSE
        inferred_chat_type := chat_type;
    END IF;
    
    -- Handle URL construction based on inferred type
    IF inferred_chat_type = 'private' THEN
        -- Private chats don't have shareable URLs
        RETURN NULL;
    ELSIF inferred_chat_type IN ('channel', 'supergroup', 'supergroup_or_channel') THEN
        -- For channels and supergroups with -100 prefix
        IF chat_id < 0 THEN
            processed_chat_id := substring(ABS(chat_id)::text, 3);
            RETURN base_url || 'c/' || processed_chat_id || '/' || message_id;
        ELSE
            processed_chat_id := chat_id::text;
            RETURN base_url || 'c/' || processed_chat_id || '/' || message_id;
        END IF;
    ELSIF inferred_chat_type = 'group' THEN
        -- For regular groups
        processed_chat_id := ABS(chat_id)::text;
        RETURN base_url || 'c/' || processed_chat_id || '/' || message_id;
    ELSE
        -- Default case for other types
        RETURN NULL;
    END IF;
END;
$$;

-- Create function specifically for extracting data from telegram_data JSONB
CREATE OR REPLACE FUNCTION xdelo_construct_message_url_from_data(telegram_data JSONB)
RETURNS TEXT AS $$
DECLARE
  v_chat_id BIGINT;
  v_message_id INT;
  v_chat_type TEXT;
BEGIN
  -- Extract the necessary fields
  v_chat_id := (telegram_data->'chat'->>'id')::BIGINT;
  v_message_id := (telegram_data->>'message_id')::INT;
  v_chat_type := telegram_data->'chat'->>'type';
  
  -- Use the generic function to build the URL
  RETURN xdelo_construct_telegram_message_url(v_chat_type, v_chat_id, v_message_id);
END;
$$ LANGUAGE plpgsql;
