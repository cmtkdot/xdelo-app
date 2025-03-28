-- Migration to add retry limits for message processing
BEGIN;

-- Add columns to track retries
ALTER TABLE messages ADD COLUMN IF NOT EXISTS processing_attempts integer DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS max_processing_attempts integer DEFAULT 3;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Modify processing_state enum if needed (assuming it exists)
-- ALTER TYPE message_processing_state ADD VALUE IF NOT EXISTS 'retry_pending';
-- ALTER TYPE message_processing_state ADD VALUE IF NOT EXISTS 'failed';

-- Update trigger function to handle retries and media group duplicates
CREATE OR REPLACE FUNCTION trg_message_processing_flow()
RETURNS TRIGGER AS $$
DECLARE
    should_process BOOLEAN := FALSE;
    old_content_hash TEXT;
    new_content_hash TEXT;
    media_group_exists BOOLEAN;
BEGIN
    -- Skip if already failed
    IF NEW.processing_state = 'failed' THEN
        RETURN NEW;
    END IF;

    -- Check for existing media group messages
    IF NEW.media_group_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM messages
            WHERE media_group_id = NEW.media_group_id
            AND file_unique_id = NEW.file_unique_id
            AND id != NEW.id
        ) INTO media_group_exists;

        IF media_group_exists THEN
            NEW.processing_state = 'duplicate';
            RETURN NEW;
        END IF;
    END IF;

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

        -- Check retry limits
        IF NEW.processing_attempts >= NEW.max_processing_attempts THEN
            NEW.processing_state := 'failed';
            NEW.processing_note := 'Max retry attempts reached';
            RETURN NEW;
        END IF;

        -- Preserve existing analysis if present
        IF OLD.analyzed_content IS NOT NULL THEN
            NEW.old_analyzed_content := OLD.analyzed_content;
        END IF;

        -- Reset processing state with retry tracking
        NEW.processing_state := 'pending_reprocess';
        NEW.analyzed_content := NULL;
        NEW.processing_attempts := COALESCE(OLD.processing_attempts, 0) + 1;
        NEW.next_retry_at := NOW() + (INTERVAL '1 minute' * LEAST(2^(NEW.processing_attempts-1), 60)); -- Exponential backoff with 1hr cap

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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update background processing function
CREATE OR REPLACE FUNCTION process_pending_messages()
RETURNS VOID AS $$
BEGIN
    -- Process messages in batches with retry logic
    -- Only process messages where next_retry_at is NULL or in the past
    WITH to_process AS (
        SELECT id
        FROM messages
        WHERE processing_state IN ('pending_reprocess', 'partial')
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
          AND processing_attempts < max_processing_attempts
        ORDER BY updated_at
        LIMIT 100
        FOR UPDATE SKIP LOCKED
    )
    UPDATE messages m
    SET
        processing_state = 'processing',
        processing_started_at = NOW()
    FROM to_process
    WHERE m.id = to_process.id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
