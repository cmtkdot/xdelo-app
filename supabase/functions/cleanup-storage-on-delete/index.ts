CREATE OR REPLACE FUNCTION public.cleanup_storage_on_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only delete storage files if this is not a Telegram deletion
    -- We check this by looking at the trigger that called us
    IF TG_NAME = 'trg_handle_regular_deletion' THEN
        -- Delete storage files
        IF OLD.storage_path IS NOT NULL THEN
            DELETE FROM storage.objects
            WHERE bucket_id = 'telegram-media'
            AND name = OLD.storage_path;
        END IF;

        IF OLD.file_unique_id IS NOT NULL AND OLD.mime_type IS NOT NULL THEN
            DELETE FROM storage.objects
            WHERE bucket_id = 'telegram-media'
            AND name LIKE OLD.file_unique_id || '.%';
        END IF;
    END IF;

    -- Log deletion regardless of type
    INSERT INTO analysis_audit_log (
        message_id,
        media_group_id,
        event_type,
        old_state,
        processing_details
    ) VALUES (
        OLD.id,
        OLD.media_group_id,
        'MESSAGE_DELETED',
        OLD.processing_state::text,
        jsonb_build_object(
            'deletion_time', now(),
            'group_message_count', OLD.group_message_count,
            'deleted_from_telegram', TG_NAME = 'trg_handle_telegram_deletion'
        )
    );

    RETURN OLD;
END;
$$;