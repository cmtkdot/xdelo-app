-- Migration to document the correct parameter order for upsert_text_message and upsert_media_message functions
-- This is for documentation purposes only and doesn't change function behavior

/*
FUNCTION: upsert_text_message

IMPORTANT PARAMETER ORDER:
1. p_telegram_message_id (bigint) - Telegram message ID
2. p_chat_id (bigint) - Chat ID
3. p_message_text (text) - Message text content
4. p_message_data (jsonb) - Raw message data from Telegram
5. p_correlation_id (text) - Correlation ID for tracking
6. p_chat_type (text) - Chat type (optional)
7. p_chat_title (text) - Chat title (optional)
8. p_forward_info (jsonb) - Forward information (optional)
9. p_processing_state (text) - Processing state (default: 'pending_analysis')
10. p_processing_error (text) - Processing error (optional)

NOTE: Parameter order is important when using positional parameters in SQL calls.
      When using named parameters in TypeScript via RPC calls, ensure parameter names match exactly.
*/

/*
FUNCTION: upsert_media_message

IMPORTANT PARAMETER LIST:
1. p_telegram_message_id (bigint) - Telegram message ID
2. p_chat_id (bigint) - Chat ID
3. p_file_unique_id (text) - Unique file ID from Telegram
4. p_file_id (text) - File ID from Telegram
5. p_storage_path (text) - Storage path
6. p_public_url (text) - Public URL
7. p_mime_type (text) - MIME type
8. p_extension (text) - File extension
9. p_media_type (text) - Media type
10. p_caption (text) - Caption
11. p_processing_state (text) - Processing state
12. p_message_data (jsonb) - Raw message data
13. p_correlation_id (text) - Correlation ID for tracking
14. p_user_id (bigint) - User ID (optional, maintained for backward compatibility)
15. p_media_group_id (text) - Media group ID (optional)
16. p_forward_info (jsonb) - Forward information (optional)
17. p_processing_error (text) - Processing error (optional)
18. p_caption_data (jsonb) - Caption data and analyzed content (optional)

NOTE: The analyzed_content and old_analyzed_content handling is managed internally in the function.
      When using this function from TypeScript, combine analyzed_content with caption_data.
*/

-- Insert record into audit logs to document this change
INSERT INTO public.unified_audit_logs (
  event_type,
  entity_id,
  correlation_id,
  metadata
) VALUES (
  'documentation_updated',
  '00000000-0000-0000-0000-000000000000',
  'system',
  jsonb_build_object(
    'migration_name', '20250410_document_function_parameters',
    'description', 'Updated documentation for parameter order in upsert_text_message and upsert_media_message functions',
    'updated_at', NOW()
  )
);
