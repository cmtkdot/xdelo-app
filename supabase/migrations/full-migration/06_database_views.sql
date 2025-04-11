-- XdeloMedia Database Views Migration
-- This script creates database views for media message caption synchronization

-- View for monitoring media group consistency and synchronization issues
CREATE OR REPLACE VIEW public.v_media_group_consistency AS
WITH media_group_stats AS (
  SELECT 
    media_group_id,
    COUNT(*) AS message_count,
    COUNT(*) FILTER (WHERE is_original_caption = TRUE) AS caption_holders,
    COUNT(*) FILTER (WHERE group_caption_synced = TRUE) AS synced_messages,
    BOOL_OR(analyzed_content IS NULL AND processing_state = 'completed') AS has_incomplete_analysis,
    COUNT(DISTINCT analyzed_content) AS distinct_analysis_count
  FROM 
    messages
  WHERE 
    media_group_id IS NOT NULL
  GROUP BY 
    media_group_id
)
SELECT 
  media_group_id,
  message_count,
  caption_holders,
  synced_messages,
  has_incomplete_analysis,
  distinct_analysis_count,
  CASE
    WHEN caption_holders = 0 THEN 0 -- No caption holder
    WHEN caption_holders > 1 THEN 1 -- Multiple caption holders
    WHEN synced_messages < message_count THEN 2 -- Not all messages synced
    WHEN has_incomplete_analysis THEN 3 -- Incomplete analysis
    WHEN distinct_analysis_count > 1 THEN 4 -- Inconsistent analysis
    ELSE 5 -- No issues
  END AS consistency_status
FROM 
  media_group_stats
ORDER BY 
  CASE
    WHEN caption_holders = 0 THEN 0
    WHEN caption_holders > 1 THEN 1
    WHEN synced_messages < message_count THEN 2
    WHEN has_incomplete_analysis THEN 3
    WHEN distinct_analysis_count > 1 THEN 4
    ELSE 5
  END, 
  media_group_id;

-- View for media messages with essential fields for synchronization
CREATE OR REPLACE VIEW public.v_media_messages AS
SELECT
  id,
  telegram_message_id,
  chat_id,
  media_group_id,
  is_original_caption,
  group_caption_synced,
  caption,
  file_id,
  file_unique_id,
  public_url,
  mime_type,
  is_edited,
  processing_state,
  analyzed_content,
  old_analyzed_content,
  error_message,
  message_data,
  correlation_id,
  storage_path,
  edit_date,
  created_at,
  updated_at,
  (SELECT COUNT(*) FROM messages m2 WHERE m2.media_group_id = messages.media_group_id) AS group_message_count
FROM 
  messages
WHERE
  file_unique_id IS NOT NULL;
