
-- Function to add missing columns to other_messages table
CREATE OR REPLACE FUNCTION xdelo_add_missing_columns_to_other_messages()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_missing_columns TEXT[] := '{}';
  v_result JSONB;
BEGIN
  -- Check if forward_info column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'other_messages' AND column_name = 'forward_info'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'forward_info');
    
    -- Add forward_info column
    ALTER TABLE other_messages ADD COLUMN forward_info JSONB;
  END IF;

  -- Check for retry_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'other_messages' AND column_name = 'retry_count'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'retry_count');
    
    -- Add retry_count column
    ALTER TABLE other_messages ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;

  -- Check for last_error_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'other_messages' AND column_name = 'last_error_at'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'last_error_at');
    
    -- Add last_error_at column
    ALTER TABLE other_messages ADD COLUMN last_error_at TIMESTAMPTZ;
  END IF;

  -- Check for message_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'other_messages' AND column_name = 'message_url'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'message_url');
    
    -- Add message_url column
    ALTER TABLE other_messages ADD COLUMN message_url TEXT;
    
    -- Update existing records to set message_url
    -- This calls the function to construct message URLs for existing records
    UPDATE other_messages
    SET message_url = xdelo_construct_message_url_from_data(telegram_data)
    WHERE telegram_data IS NOT NULL AND (message_url IS NULL OR message_url = '');
  END IF;

  -- Check for is_forward column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'other_messages' AND column_name = 'is_forward'
  ) THEN
    v_missing_columns := array_append(v_missing_columns, 'is_forward');
    
    -- Add is_forward column
    ALTER TABLE other_messages ADD COLUMN is_forward BOOLEAN DEFAULT false;
    
    -- Update existing records to set is_forward based on telegram_data
    UPDATE other_messages
    SET is_forward = 
      (telegram_data ? 'forward_from' OR 
       telegram_data ? 'forward_from_chat' OR 
       telegram_data ? 'forward_origin')
    WHERE telegram_data IS NOT NULL;
  END IF;

  -- Check if processing_state is an enum type and create it if needed
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'processing_state_type'
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
    -- If the type exists, make sure it has the 'stored_only' value
    BEGIN
      ALTER TYPE processing_state_type ADD VALUE 'stored_only' AFTER 'initialized';
    EXCEPTION
      WHEN duplicate_object THEN
        -- Value already exists, do nothing
    END;
  END IF;

  -- Create triggers for message_url generation if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_message_url_on_other_message_insert'
  ) THEN
    -- Create message URL trigger for INSERT
    CREATE TRIGGER set_message_url_on_other_message_insert
    BEFORE INSERT ON other_messages
    FOR EACH ROW
    EXECUTE FUNCTION xdelo_set_message_url_on_other_message();
    
    v_missing_columns := array_append(v_missing_columns, 'set_message_url_on_other_message_insert trigger');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'set_message_url_on_other_message_update'
  ) THEN
    -- Create message URL trigger for UPDATE
    CREATE TRIGGER set_message_url_on_other_message_update
    BEFORE UPDATE ON other_messages
    FOR EACH ROW
    WHEN (OLD.telegram_data IS DISTINCT FROM NEW.telegram_data)
    EXECUTE FUNCTION xdelo_set_message_url_on_other_message();
    
    v_missing_columns := array_append(v_missing_columns, 'set_message_url_on_other_message_update trigger');
  END IF;

  -- Build result object
  v_result := jsonb_build_object(
    'success', true,
    'columns_added', v_missing_columns,
    'timestamp', current_timestamp
  );
  
  IF array_length(v_missing_columns, 1) > 0 THEN
    v_result := jsonb_set(v_result, '{message}', to_jsonb('Added missing columns: ' || array_to_string(v_missing_columns, ', ')));
  ELSE
    v_result := jsonb_set(v_result, '{message}', to_jsonb('All required columns already exist'));
  END IF;
  
  RETURN v_result;
END;
$$;

-- Create the xdelo_run_fix_missing_columns function to be called via RPC
CREATE OR REPLACE FUNCTION xdelo_run_fix_missing_columns()
RETURNS JSONB SECURITY DEFINER AS $$
BEGIN
  RETURN xdelo_add_missing_columns_to_other_messages();
END;
$$ LANGUAGE plpgsql;
