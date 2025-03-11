
-- Start transaction
BEGIN;

-- Now we can safely drop the functions
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_history;
DROP FUNCTION IF EXISTS public.xdelo_sync_pending_media_group_messages;
DROP FUNCTION IF EXISTS public.xdelo_reset_stalled_messages;
DROP FUNCTION IF EXISTS public.xdelo_update_message_with_analyzed_content;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_update;
DROP FUNCTION IF EXISTS public.xdelo_commit_transaction_with_sync;

-- Commit transaction
COMMIT;
