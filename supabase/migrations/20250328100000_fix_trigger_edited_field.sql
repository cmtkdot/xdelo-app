-- Migration to fix trigger that references non-existent 'edited' field
BEGIN;

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trg_message_processing_flow ON messages;

-- Recreate the trigger function without the NEW.edited assignment
CREATE OR REPLACE FUNCTION trg_message_processing_flow()
RETURNS TRIGGER AS $$
DECLARE
    should_process BOOLEAN := FALSE;
    old_content_hash TEXT;
    new_content_hash TEXT;
BEGIN
    -- Set timeout for this operation
    SET LOCAL statement_timeout = '30s';

    -- Calculate content hashes (text + caption + media metadata)
    old_content_hash := md5(
        COALESCE(OLD.text, '') ||
        COALESCE(OLD.caption, '') ||
        COALESCE(OLD.file_unique_id, '')
    );
    new_content_hash := md5(
        COALESCE(NEW.text, '') ||
        COALESCE(NEW.caption, '') ||
        COALESCE(NEW.file_unique_id, '')
    );

    -- Check for meaningful content changes
    IF (new_content_hash != old_content_hash) OR
       (NEW.edit_date IS DISTINCT FROM OLD.edit_date) THEN

        -- Preserve existing analysis if present
        IF OLD.analyzed_content IS NOT NULL THEN
            NEW.old_analyzed_content := OLD.analyzed_content;
        END IF;

        -- Reset processing state
        NEW.processing_state := 'pending_reprocess';
        NEW.analyzed_content := NULL;

        -- Update edit history
        NEW.edit_history :=
            COALESCE(OLD.edit_history, '[]'::jsonb) ||
            jsonb_build_object(
                'timestamp', COALESCE(OLD.updated_at, OLD.created_at),
                'content', jsonb_build_object(
                    'text', OLD.text,
                    'caption', OLD.caption,
                    'media_id', OLD.file_unique_id
                )
            );

        should_process := TRUE;
    END IF;

    -- Handle timeout scenario
    EXCEPTION WHEN statement_timeout THEN
        NEW.processing_state := 'partial';
        NEW.processing_note := 'Timeout during initial processing';
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER trg_message_processing_flow
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_message_processing_flow();

COMMIT;
