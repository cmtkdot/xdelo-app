
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
    -- Use the existing function to construct the URL
    NEW.message_url := xdelo_construct_telegram_message_url(v_chat_type, v_chat_id, v_message_id);
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
BEGIN
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
  
  -- Return success
  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Message URL triggers updated successfully',
    'timestamp', CURRENT_TIMESTAMP
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
