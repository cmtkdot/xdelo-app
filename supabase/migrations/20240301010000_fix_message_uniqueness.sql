
-- First drop any existing constraints
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS unique_active_file_in_chat;

DROP CONSTRAINT IF EXISTS messages_file_unique_id_key;
DROP CONSTRAINT IF EXISTS messages_file_unique_id_active_key;

-- Create a regular unique constraint
CREATE UNIQUE INDEX messages_unique_file_in_chat
ON messages (file_unique_id, chat_id)
WHERE deleted_from_telegram = false AND is_forward = false;

-- Add an index to improve forward lookups
CREATE INDEX IF NOT EXISTS idx_messages_forward_lookup 
ON messages (file_unique_id, is_forward) 
WHERE deleted_from_telegram = false;
