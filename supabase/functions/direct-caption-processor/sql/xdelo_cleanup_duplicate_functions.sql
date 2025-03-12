
-- This script will drop duplicate or unused functions
-- WARNING: Please review carefully before running!

-- Drop functions that have been replaced or are no longer needed

-- 1. xdelo_analyze_message_caption is replaced by manual-caption-parser edge function
DROP FUNCTION IF EXISTS xdelo_analyze_message_caption(uuid, uuid, text, text);

-- 2. xdelo_handle_failed_caption_analysis is no longer needed with simplified flow
DROP FUNCTION IF EXISTS xdelo_handle_failed_caption_analysis(uuid, text);

-- 3. xdelo_begin_transaction and xdelo_commit_transaction_with_sync are no longer needed
DROP FUNCTION IF EXISTS xdelo_begin_transaction();
DROP FUNCTION IF EXISTS xdelo_commit_transaction_with_sync(uuid, text, uuid);

-- 4. xdelo_reset_stalled_messages is no longer needed with simplified flow
DROP FUNCTION IF EXISTS xdelo_reset_stalled_messages();

-- 5. xdelo_process_pending_messages is no longer needed with simplified flow
DROP FUNCTION IF EXISTS xdelo_process_pending_messages(integer);

-- 6. xdelo_queue_message_for_processing is no longer needed with direct processing
DROP FUNCTION IF EXISTS xdelo_queue_message_for_processing(uuid, uuid, integer);

-- 7. xdelo_dequeue_message_for_processing is no longer needed with direct processing
DROP FUNCTION IF EXISTS xdelo_dequeue_message_for_processing();

-- 8. xdelo_repair_media_group_syncs is replaced by simpler xdelo_sync_media_group_content
DROP FUNCTION IF EXISTS xdelo_repair_media_group_syncs();

-- Keep existing direct utility functions that are still useful:
-- 1. xdelo_fix_mime_types - Useful for fixing MIME types
-- 2. xdelo_fix_storage_paths - Useful for storage path management
-- 3. xdelo_redownload_missing_media - Useful for media recovery
