-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trg_sync_media_group_after_analysis ON messages;
DROP FUNCTION IF EXISTS public.sync_media_group_after_analysis();
DROP FUNCTION IF EXISTS public.process_media_group_analysis(uuid, text, jsonb, timestamp with time zone);

-- Remove Glide sync columns from messages table
ALTER TABLE messages
    DROP COLUMN IF EXISTS glide_sync_status,
    DROP COLUMN IF EXISTS glide_sync_attempts,
    DROP COLUMN IF EXISTS glide_sync_error;
