-- Add columns for duplicate content handling
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_duplicate_content BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_message_id UUID REFERENCES messages(id) NULL,
  ADD COLUMN IF NOT EXISTS old_analyzed_content JSONB[] DEFAULT ARRAY[]::JSONB[];

-- Create index on file_unique_id to speed up duplicate detection
CREATE INDEX IF NOT EXISTS idx_messages_file_unique_id ON messages (file_unique_id);

-- Create Function to handle duplicate file detection
CREATE OR REPLACE FUNCTION xdelo_handle_duplicate_file_detection() 
RETURNS TRIGGER AS $$
BEGIN
  -- If a file with the same file_unique_id already exists, mark as duplicate
  IF NEW.file_unique_id IS NOT NULL AND 
     EXISTS (SELECT 1 FROM messages 
             WHERE file_unique_id = NEW.file_unique_id 
               AND id != NEW.id
               AND analyzed_content IS NOT NULL) THEN
    
    -- Get the most recent message with same file_unique_id and its analyzed content
    WITH recent_duplicate AS (
      SELECT id, analyzed_content 
      FROM messages
      WHERE file_unique_id = NEW.file_unique_id
        AND analyzed_content IS NOT NULL
        AND id != NEW.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    UPDATE messages
    SET is_duplicate_content = TRUE,
        duplicate_of_message_id = rd.id,
        analyzed_content = rd.analyzed_content,
        processing_state = 'completed',
        processing_completed_at = CURRENT_TIMESTAMP
    FROM recent_duplicate rd
    WHERE messages.id = NEW.id;

    -- Log this operation
    INSERT INTO unified_audit_logs (
      event_type, 
      entity_id, 
      metadata, 
      correlation_id
    ) VALUES (
      'duplicate_detected',
      NEW.id,
      jsonb_build_object(
        'file_unique_id', NEW.file_unique_id,
        'source_message_id', (SELECT id FROM recent_duplicate),
        'telegram_message_id', NEW.telegram_message_id,
        'chat_id', NEW.chat_id
      ),
      COALESCE(NEW.correlation_id, gen_random_uuid()::text)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger for duplicate detection
DROP TRIGGER IF EXISTS trg_handle_duplicate_file ON messages;

CREATE TRIGGER trg_handle_duplicate_file
AFTER INSERT ON messages
FOR EACH ROW
WHEN (NEW.file_unique_id IS NOT NULL)
EXECUTE FUNCTION xdelo_handle_duplicate_file_detection();

-- Function to update analyzed_content while preserving history
CREATE OR REPLACE FUNCTION xdelo_update_message_analyzed_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Store previous analyzed_content in the old_analyzed_content array if it exists and changes
  IF OLD.analyzed_content IS NOT NULL AND 
     OLD.analyzed_content != NEW.analyzed_content AND 
     NEW.analyzed_content IS NOT NULL THEN
    
    -- Add the old content to the array
    NEW.old_analyzed_content = COALESCE(OLD.old_analyzed_content, ARRAY[]::jsonb[]) || OLD.analyzed_content;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger for preserving analyzed_content history
DROP TRIGGER IF EXISTS trg_update_message_analyzed_content ON messages;

CREATE TRIGGER trg_update_message_analyzed_content
BEFORE UPDATE ON messages
FOR EACH ROW
WHEN (OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content)
EXECUTE FUNCTION xdelo_update_message_analyzed_content(); 