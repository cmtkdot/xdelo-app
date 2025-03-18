
-- Function to generate a Telegram message URL from extracted components
CREATE OR REPLACE FUNCTION xdelo_construct_telegram_message_url(
  chat_type TEXT,
  chat_id BIGINT,
  message_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  base_url TEXT := 'https://t.me/';
BEGIN
  -- Handle different chat types accordingly
  IF chat_type = 'channel' OR chat_type = 'supergroup' THEN
    -- For channels and supergroups, get the username or use the ID
    -- Channel URLs look like: https://t.me/channel_username/1234
    -- If no username, we use the ID with a c/ prefix: https://t.me/c/1234567890/1234
    -- We need to extract the username from the telegram_data
    -- For now we use the c/ format as it works for all channels
    RETURN base_url || 'c/' || ABS(chat_id)::TEXT || '/' || message_id::TEXT;
  ELSIF chat_type = 'group' THEN
    -- For regular groups: https://t.me/c/1234567890/1234
    RETURN base_url || 'c/' || ABS(chat_id)::TEXT || '/' || message_id::TEXT;
  ELSIF chat_type = 'private' THEN
    -- Private chats don't have public links
    RETURN NULL;
  ELSE
    -- Default fallback
    RETURN base_url || 'c/' || ABS(chat_id)::TEXT || '/' || message_id::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to extract message_id from telegram_data JSONB
CREATE OR REPLACE FUNCTION xdelo_extract_telegram_message_id(telegram_data JSONB)
RETURNS INTEGER AS $$
BEGIN
  RETURN (telegram_data->>'message_id')::INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to extract chat_id from telegram_data JSONB
CREATE OR REPLACE FUNCTION xdelo_extract_chat_id(telegram_data JSONB)
RETURNS BIGINT AS $$
BEGIN
  RETURN (telegram_data->'chat'->>'id')::BIGINT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to extract chat_type from telegram_data JSONB
CREATE OR REPLACE FUNCTION xdelo_extract_chat_type(telegram_data JSONB)
RETURNS TEXT AS $$
BEGIN
  RETURN telegram_data->'chat'->>'type';
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create an improved message URL generator for other_messages
CREATE OR REPLACE FUNCTION xdelo_set_message_url_on_other_message()
RETURNS TRIGGER AS $$
DECLARE
  v_message_id INTEGER;
  v_chat_id BIGINT;
  v_chat_type TEXT;
BEGIN
  -- Extract data from telegram_data JSONB field
  v_message_id := xdelo_extract_telegram_message_id(NEW.telegram_data);
  v_chat_id := xdelo_extract_chat_id(NEW.telegram_data);
  v_chat_type := xdelo_extract_chat_type(NEW.telegram_data);

  -- Only proceed if we have valid data
  IF v_message_id IS NOT NULL AND v_chat_id IS NOT NULL AND v_chat_type IS NOT NULL THEN
    -- Use the dedicated function to construct the URL
    NEW.message_url := xdelo_construct_telegram_message_url(v_chat_type, v_chat_id, v_message_id);
    
    -- Ensure telegram_message_id is set from the JSONB data
    IF NEW.telegram_message_id IS NULL THEN
      NEW.telegram_message_id := v_message_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function that can be called via RPC to update the triggers
CREATE OR REPLACE FUNCTION xdelo_update_message_url_triggers()
RETURNS JSONB AS $$
DECLARE
  v_trigger_exists BOOLEAN;
  v_result JSONB;
  v_missing_columns TEXT;
BEGIN
  -- Check for missing columns in other_messages
  SELECT string_agg(column_name, ', ')
  INTO v_missing_columns
  FROM (
    VALUES 
      ('retry_count'), 
      ('last_error_at'), 
      ('forward_info')
  ) AS missing(column_name)
  WHERE NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'other_messages' 
    AND column_name = missing.column_name
  );
  
  -- Add missing columns if needed
  IF v_missing_columns IS NOT NULL THEN
    EXECUTE '
      ALTER TABLE other_messages 
      ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS forward_info JSONB
    ';
  END IF;
  
  -- Check if is_forward column exists but is wrong type
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'other_messages' 
    AND column_name = 'is_forward'
    AND data_type <> 'boolean'
  ) THEN
    -- Fix the column type
    ALTER TABLE other_messages 
    ALTER COLUMN is_forward TYPE BOOLEAN USING (is_forward::TEXT)::BOOLEAN;
  END IF;
  
  -- Check if the trigger exists on other_messages
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_message_url_on_other_message_insert'
  ) INTO v_trigger_exists;
  
  -- Drop existing trigger if it exists
  IF v_trigger_exists THEN
    DROP TRIGGER IF EXISTS set_message_url_on_other_message_insert ON other_messages;
    DROP TRIGGER IF EXISTS set_message_url_on_other_message_update ON other_messages;
  END IF;
  
  -- Create new triggers with improved function
  CREATE TRIGGER set_message_url_on_other_message_insert
  BEFORE INSERT ON other_messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_set_message_url_on_other_message();
  
  CREATE TRIGGER set_message_url_on_other_message_update
  BEFORE UPDATE ON other_messages
  FOR EACH ROW
  WHEN (OLD.telegram_data IS DISTINCT FROM NEW.telegram_data)
  EXECUTE FUNCTION xdelo_set_message_url_on_other_message();
  
  -- Add processing_state enum type if needed
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_type 
      WHERE typname = 'processing_state_type'
    ) THEN
      CREATE TYPE processing_state_type AS ENUM (
        'pending', 
        'processing', 
        'completed', 
        'error', 
        'initialized',
        'stored_only'
      );
    ELSE
      -- If the type exists but doesn't have 'stored_only'
      BEGIN
        ALTER TYPE processing_state_type ADD VALUE 'stored_only' AFTER 'initialized';
      EXCEPTION
        WHEN duplicate_object THEN
          -- Value already exists, ignore
      END;
    END IF;
  END
  $$;
  
  -- Return success
  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Message URL triggers updated successfully',
    'missing_columns_added', v_missing_columns IS NOT NULL,
    'added_columns', v_missing_columns,
    'triggers_updated', true,
    'timestamp', CURRENT_TIMESTAMP
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
