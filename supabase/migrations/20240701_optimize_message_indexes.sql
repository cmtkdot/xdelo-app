
-- Add more effective indexes for message processing and editing
-- These will improve the performance of the queries we're using

-- Index for media group operations
CREATE INDEX IF NOT EXISTS idx_messages_media_group_id ON messages (media_group_id);

-- Index for processing state tracking
CREATE INDEX IF NOT EXISTS idx_messages_processing_state ON messages (processing_state);

-- Combined index for message editing operations
CREATE INDEX IF NOT EXISTS idx_messages_telegram_chat_message ON messages (chat_id, telegram_message_id);

-- Index for caption searches
CREATE INDEX IF NOT EXISTS idx_messages_caption_text ON messages USING gin(to_tsvector('english', caption));

-- Index for correlation tracking
CREATE INDEX IF NOT EXISTS idx_messages_correlation_id ON messages (correlation_id);

-- Index for edit tracking
CREATE INDEX IF NOT EXISTS idx_messages_is_original_caption ON messages (is_original_caption) WHERE is_original_caption = true;
