-- Migration to execute the function cleanup while preserving essential ones
BEGIN;

-- 1. First verify the essential functions exist
DO $$
BEGIN
    -- Check if essential functions exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'xdelo_sync_media_group_content'
        AND proargtypes::text LIKE '%jsonb%'
    ) THEN
        RAISE EXCEPTION 'Essential function xdelo_sync_media_group_content missing - aborting cleanup';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'xdelo_set_caption_pending_trigger'
    ) THEN
        RAISE EXCEPTION 'Essential function xdelo_set_caption_pending_trigger missing - aborting cleanup';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'xdelo_audit_message_changes'
    ) THEN
        RAISE EXCEPTION 'Essential function xdelo_audit_message_changes missing - aborting cleanup';
    END IF;
END $$;

-- 2. Execute the cleanup from our prepared migration file
\i supabase/migrations/20250327_cleanup_legacy_functions.sql

-- 3. Final verification
DO $$
BEGIN
    -- Verify the three essential functions still exist
    PERFORM 1 FROM pg_proc
    WHERE proname = 'xdelo_sync_media_group_content'
    AND proargtypes::text LIKE '%jsonb%';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification failed: xdelo_sync_media_group_content missing after cleanup';
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'xdelo_set_caption_pending_trigger';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification failed: xdelo_set_caption_pending_trigger missing after cleanup';
    END IF;

    PERFORM 1 FROM pg_proc WHERE proname = 'xdelo_audit_message_changes';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Verification failed: xdelo_audit_message_changes missing after cleanup';
    END IF;

    RAISE NOTICE 'Function cleanup completed successfully. Essential functions preserved.';
END $$;

COMMIT;

-- 4. Document the execution
COMMENT ON DATABASE current_database() IS 'Legacy functions cleanup executed on 2025-03-27. Preserved essential Telegram webhook functions.';
