
-- Check and backup any data we might need
CREATE TABLE IF NOT EXISTS messages_backup_march2024 AS 
SELECT * FROM messages;

-- Redundant Forward-related columns
ALTER TABLE messages
DROP COLUMN IF EXISTS is_forwarded,
DROP COLUMN IF EXISTS is_forwarded_from,
DROP COLUMN IF EXISTS is_forward_from,
DROP COLUMN IF EXISTS forward_info;

-- Redundant Caption/Edit columns
ALTER TABLE messages
DROP COLUMN IF EXISTS is_edited_channel_post,
DROP COLUMN IF EXISTS is_channel_post;

-- Redundant Processing columns
ALTER TABLE messages 
DROP COLUMN IF EXISTS sync_attempt;

-- Drop redundant product/vendor fields since they're in analyzed_content
ALTER TABLE messages
DROP COLUMN IF EXISTS product_name,
DROP COLUMN IF EXISTS product_unit,
DROP COLUMN IF EXISTS vendor_name,
DROP COLUMN IF EXISTS product_sku,
DROP COLUMN IF EXISTS storage_path,
DROP COLUMN IF EXISTS group_message_count;

-- Drop redundant indexes
DROP INDEX IF EXISTS idx_messages_media_group;
DROP INDEX IF EXISTS idx_messages_processing_state_media_group;
DROP INDEX IF EXISTS idx_messages_media_group_processing;
DROP INDEX IF EXISTS idx_messages_product_sku;
DROP INDEX IF EXISTS idx_messages_product_name;

-- Drop redundant triggers
DROP TRIGGER IF EXISTS xdelo_trg_set_timestamp ON messages;

-- Create new optimized indexes
CREATE INDEX IF NOT EXISTS idx_messages_media_group_optimized ON messages (media_group_id, processing_state, is_original_caption)
WHERE media_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_analyzed_content ON messages USING gin(analyzed_content)
WHERE analyzed_content IS NOT NULL;

-- Update trigger to handle all message updates
DROP TRIGGER IF EXISTS xdelo_trg_message_update ON messages;
CREATE TRIGGER xdelo_trg_message_update
    BEFORE UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION xdelo_handle_message_update();

-- Add comment to document the cleanup
COMMENT ON TABLE messages IS 'Cleaned up on March 2024. Stores Telegram messages with their media groups, forwarding info, and analysis results.';

