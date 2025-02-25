-- Fix the message_deletion_logs table and related functions

-- First, update the message_deletion_logs table to include the deletion_source field if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'message_deletion_logs' 
        AND column_name = 'deletion_source'
    ) THEN
        ALTER TABLE public.message_deletion_logs ADD COLUMN deletion_source text NULL;
        
        -- Add the check constraint
        ALTER TABLE public.message_deletion_logs 
        ADD CONSTRAINT message_deletion_logs_deletion_source_check 
        CHECK (deletion_source = ANY (ARRAY['telegram'::text, 'database'::text, 'both'::text]));
    END IF;
END
$$;

-- Update the xdelo_handle_other_message_deletion function to include the deletion_source field
CREATE OR REPLACE FUNCTION xdelo_handle_other_message_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the deletion in the message_deletion_logs table
  INSERT INTO message_deletion_logs (
    message_id,
    message_type,
    telegram_message_id,
    chat_id,
    deleted_at,
    deletion_reason,
    deletion_source
  ) VALUES (
    OLD.id,
    'other_message',
    OLD.telegram_message_id,
    OLD.chat_id,
    NOW(),
    'user_initiated',
    'database'  -- Default to 'database' since this is triggered by a database deletion
  );
  
  -- Return the old record to allow the deletion to proceed
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the xdelo_handle_message_deletion function for the messages table
CREATE OR REPLACE FUNCTION xdelo_handle_message_deletion(source text)
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into deleted_messages table to keep a record
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
    (source = 'telegram'),
    OLD.user_id
  );
  
  -- Log the deletion in the message_deletion_logs table
  INSERT INTO message_deletion_logs (
    message_id,
    message_type,
    telegram_message_id,
    chat_id,
    deleted_at,
    deletion_reason,
    deletion_source
  ) VALUES (
    OLD.id,
    'message',
    OLD.telegram_message_id,
    OLD.chat_id,
    NOW(),
    CASE 
      WHEN source = 'telegram' THEN 'deleted_from_telegram'
      ELSE 'user_initiated'
    END,
    source  -- Use the provided source parameter
  );
  
  -- Return the old record to allow the deletion to proceed
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the triggers for message deletion
DROP TRIGGER IF EXISTS xdelo_trg_database_deletion ON messages;
DROP TRIGGER IF EXISTS xdelo_trg_telegram_deletion ON messages;

-- Create triggers for message deletion based on the source
CREATE TRIGGER xdelo_trg_database_deletion 
BEFORE DELETE ON messages 
FOR EACH ROW 
WHEN (OLD.deleted_from_telegram = false)
EXECUTE FUNCTION xdelo_handle_message_deletion('database');

CREATE TRIGGER xdelo_trg_telegram_deletion 
BEFORE DELETE ON messages 
FOR EACH ROW 
WHEN (OLD.deleted_from_telegram = true)
EXECUTE FUNCTION xdelo_handle_message_deletion('telegram');
