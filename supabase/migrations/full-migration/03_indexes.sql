-- XdeloMedia Database Indexes Migration
-- This script creates all the necessary indexes for optimal performance

-- Indexes for messages table
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_unique_id 
    ON messages (file_unique_id) 
    WHERE file_unique_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_telegram_message_id 
    ON messages (telegram_message_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id 
    ON messages (chat_id);

CREATE INDEX IF NOT EXISTS idx_messages_chat_telegram_message_id 
    ON messages (chat_id, telegram_message_id);

CREATE INDEX IF NOT EXISTS idx_messages_media_group_id 
    ON messages (media_group_id) 
    WHERE media_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_processing_state 
    ON messages (processing_state);

CREATE INDEX IF NOT EXISTS idx_messages_created_at 
    ON messages (created_at);

CREATE INDEX IF NOT EXISTS idx_messages_user_id 
    ON messages (user_id) 
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_is_forward 
    ON messages (is_forward) 
    WHERE is_forward = TRUE;

CREATE INDEX IF NOT EXISTS idx_messages_purchase_order_uid 
    ON messages (purchase_order_uid) 
    WHERE purchase_order_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_product_name 
    ON messages (product_name) 
    WHERE product_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_product_sku 
    ON messages (product_sku) 
    WHERE product_sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_message_caption_id 
    ON messages (message_caption_id) 
    WHERE message_caption_id IS NOT NULL;

-- Indexes for other_messages table
CREATE INDEX IF NOT EXISTS idx_other_messages_telegram_message_id 
    ON other_messages (telegram_message_id);

CREATE INDEX IF NOT EXISTS idx_other_messages_chat_id 
    ON other_messages (chat_id);

CREATE INDEX IF NOT EXISTS idx_other_messages_processing_state 
    ON other_messages (processing_state);

CREATE INDEX IF NOT EXISTS idx_other_messages_created_at 
    ON other_messages (created_at);

CREATE INDEX IF NOT EXISTS idx_other_messages_user_id 
    ON other_messages (user_id) 
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_other_messages_is_forward 
    ON other_messages (is_forward) 
    WHERE is_forward = TRUE;

CREATE INDEX IF NOT EXISTS idx_other_messages_message_type 
    ON other_messages (message_type);

-- Indexes for unified_audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
    ON unified_audit_logs (timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type 
    ON unified_audit_logs (event_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_chat_id 
    ON unified_audit_logs (chat_id) 
    WHERE chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id 
    ON unified_audit_logs (entity_id) 
    WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id 
    ON unified_audit_logs (correlation_id) 
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_media_group_id 
    ON unified_audit_logs (media_group_id) 
    WHERE media_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_file_unique_id 
    ON unified_audit_logs (file_unique_id) 
    WHERE file_unique_id IS NOT NULL;

-- Indexes for analysis_queue table
CREATE INDEX IF NOT EXISTS idx_analysis_queue_status 
    ON analysis_queue (status);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_message_id 
    ON analysis_queue (message_id);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_created_at 
    ON analysis_queue (created_at);

CREATE INDEX IF NOT EXISTS idx_analysis_queue_priority 
    ON analysis_queue (priority DESC);

-- Indexes for deleted_messages table
CREATE INDEX IF NOT EXISTS idx_deleted_messages_original_id 
    ON deleted_messages (original_id);

CREATE INDEX IF NOT EXISTS idx_deleted_messages_telegram_message_id 
    ON deleted_messages (telegram_message_id);

CREATE INDEX IF NOT EXISTS idx_deleted_messages_file_unique_id 
    ON deleted_messages (file_unique_id) 
    WHERE file_unique_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deleted_messages_deleted_at 
    ON deleted_messages (deleted_at);

-- Indexes for product_matching_config table
CREATE INDEX IF NOT EXISTS idx_product_matching_config_is_active 
    ON product_matching_config (is_active);

CREATE INDEX IF NOT EXISTS idx_product_matching_config_config_name 
    ON product_matching_config (config_name);

-- Indexes for settings table
CREATE INDEX IF NOT EXISTS idx_settings_key 
    ON settings (key);

CREATE INDEX IF NOT EXISTS idx_settings_is_public 
    ON settings (is_public);

-- Indexes for sync_matches table
CREATE INDEX IF NOT EXISTS idx_sync_matches_supabase_id 
    ON sync_matches (supabase_id);

CREATE INDEX IF NOT EXISTS idx_sync_matches_glide_id 
    ON sync_matches (glide_id);

CREATE INDEX IF NOT EXISTS idx_sync_matches_table_name 
    ON sync_matches (table_name);

CREATE INDEX IF NOT EXISTS idx_sync_matches_status 
    ON sync_matches (status);

-- JSONB specific indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_messages_analyzed_content_gin 
    ON messages USING GIN (analyzed_content);

CREATE INDEX IF NOT EXISTS idx_messages_message_data_gin 
    ON messages USING GIN (message_data);

CREATE INDEX IF NOT EXISTS idx_other_messages_analyzed_content_gin 
    ON other_messages USING GIN (analyzed_content);

CREATE INDEX IF NOT EXISTS idx_other_messages_telegram_data_gin 
    ON other_messages USING GIN (telegram_data);

CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_metadata_gin 
    ON unified_audit_logs USING GIN (metadata);

-- Indexes for forward_info JSONB fields
CREATE INDEX IF NOT EXISTS idx_messages_forward_info_gin 
    ON messages USING GIN (forward_info);

CREATE INDEX IF NOT EXISTS idx_other_messages_forward_info_gin 
    ON other_messages USING GIN (forward_info);
