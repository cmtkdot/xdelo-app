-- Migration to clean up legacy functions while preserving essential ones
-- Preserves only the functions actively used in the current Telegram webhook workflow

-- 1. First document what we're keeping and why
COMMENT ON FUNCTION public.xdelo_sync_media_group_content(uuid, jsonb, bool, bool) IS
'Active function used by direct-caption-processor to sync analyzed_content across media groups. Keep.';

COMMENT ON FUNCTION public.xdelo_set_caption_pending_trigger() IS
'Active trigger function that initiates caption processing workflow. Keep.';

COMMENT ON FUNCTION public.xdelo_audit_message_changes() IS
'Active function for audit logging of message changes. Keep.';

-- 2. Drop deprecated functions in safe order (grouped by functionality)

-- First drop functions that might depend on others
DROP FUNCTION IF EXISTS public.xdelo_process_caption_workflow(uuid, text, bool) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_process_caption_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_validate_media_group_sync() CASCADE;

-- Drop old versions of sync function
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content(text, uuid, text) CASCADE;

-- Drop old parsing functions
DROP FUNCTION IF EXISTS public.xdelo_parse_caption(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_parse_caption(text) CASCADE;

-- Drop deprecated logging functions
DROP FUNCTION IF EXISTS public.xdelo_log_processing_event(text, text, text, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_logprocessingevent(text, text, text, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_event(audit_event_type, uuid, int8, int8, jsonb, jsonb, jsonb, text, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_event(text, uuid, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_event_flexible(text, uuid, int8, int8, jsonb, jsonb, jsonb, text, uuid, text) CASCADE;

-- Drop media group handling functions
DROP FUNCTION IF EXISTS public.xdelo_find_broken_media_groups() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_get_incomplete_media_groups(int4) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_repair_media_group_syncs() CASCADE;

-- Drop message handling functions
DROP FUNCTION IF EXISTS public.xdelo_handle_message_edit(uuid, text, bool, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_update(uuid, text, bool, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_update() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_forward_media() CASCADE;

-- Drop utility functions
DROP FUNCTION IF EXISTS public.xdelo_extract_analyzed_content() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_extract_telegram_metadata(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_find_caption_message(text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_find_valid_file_id(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_fix_audit_log_uuids() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_fix_public_urls(int4) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_get_message_for_processing(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_get_message_forward_history(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_get_product_matching_config() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_has_valid_caption(text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_kill_long_queries(int4) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_deleted_message() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_message_operation(text, uuid, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_message_operation(message_operation_type, uuid, uuid, text, int8, int8, jsonb, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_log_operation(text, uuid, jsonb, jsonb, jsonb, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_mark_for_redownload(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_prepare_message_for_webhook(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_product_sku_generate() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_purchase_order_uid() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_repair_file(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_retry_operation(int4, int4) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_set_file_id_expiration() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_set_message_processing(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_set_public_url() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_set_statement_timeout(int4) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_standardize_file_extension(text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_standardize_storage_path(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_update_product_matching_config(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_validate_message_ids(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_get_logger(text) CASCADE;

-- 3. Verify essential functions remain
DO $$
BEGIN
    -- Check if essential functions exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'xdelo_sync_media_group_content'
        AND proargtypes::text LIKE '%jsonb%'
    ) THEN
        RAISE EXCEPTION 'Essential function xdelo_sync_media_group_content missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'xdelo_set_caption_pending_trigger'
    ) THEN
        RAISE EXCEPTION 'Essential function xdelo_set_caption_pending_trigger missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'xdelo_audit_message_changes'
    ) THEN
        RAISE EXCEPTION 'Essential function xdelo_audit_message_changes missing';
    END IF;

    RAISE NOTICE 'Cleanup completed successfully - essential functions preserved';
END $$;

-- 4. Document the cleanup
COMMENT ON DATABASE current_database() IS 'Legacy functions cleaned up on 2025-03-27. Preserved only active functions for Telegram webhook workflow.';
