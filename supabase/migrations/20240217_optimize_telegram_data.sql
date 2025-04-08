
-- Add new column for storing only essential telegram metadata
ALTER TABLE messages ADD COLUMN IF NOT EXISTS telegram_metadata JSONB;

-- Create an index on critical search fields to improve performance
CREATE INDEX IF NOT EXISTS idx_telegram_message_chat ON messages (telegram_message_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_media_group_id ON messages (media_group_id) WHERE media_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_unique_id ON messages (file_unique_id) WHERE file_unique_id IS NOT NULL;

-- Create an RPC function to kill long-running queries
CREATE OR REPLACE FUNCTION xdelo_kill_long_queries(older_than_seconds integer DEFAULT 60)
RETURNS TABLE (
    pid integer,
    usename text,
    query_start timestamp with time zone,
    state text,
    query text,
    killed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH long_queries AS (
        SELECT 
            pid,
            usename,
            query_start,
            state,
            query
        FROM 
            pg_stat_activity
        WHERE 
            state != 'idle' AND
            query_start < (NOW() - (older_than_seconds || ' seconds')::interval) AND
            pid != pg_backend_pid()
    ),
    killed_queries AS (
        SELECT 
            l.pid,
            l.usename,
            l.query_start,
            l.state,
            l.query,
            pg_terminate_backend(l.pid) AS killed
        FROM long_queries l
    )
    SELECT * FROM killed_queries;
END;
$$;

-- Function to increment the retry count safely (atomic operation)
CREATE OR REPLACE FUNCTION increment_retry_count(message_id uuid) 
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_count integer;
BEGIN
    UPDATE messages
    SET retry_count = COALESCE(retry_count, 0) + 1
    WHERE id = message_id
    RETURNING retry_count INTO new_count;
    
    RETURN new_count;
END;
$$;

-- One-time data migration (use with caution on large tables)
-- Extracts minimal metadata from telegram_data
CREATE OR REPLACE FUNCTION migrate_telegram_data_to_metadata()
RETURNS TABLE(migrated_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    batch_size integer := 1000;
    current_offset integer := 0;
    has_more boolean := true;
    migrated_batch_count integer;
    total_migrated bigint := 0;
BEGIN
    -- Process in batches to avoid locks and timeouts
    WHILE has_more LOOP
        migrated_batch_count := 0;
        
        WITH to_migrate AS (
            SELECT 
                id, 
                telegram_data 
            FROM 
                messages
            WHERE 
                telegram_metadata IS NULL 
                AND telegram_data IS NOT NULL
            ORDER BY id
            LIMIT batch_size
            OFFSET current_offset
            FOR UPDATE SKIP LOCKED
        ),
        migrated AS (
            UPDATE messages m
            SET 
                telegram_metadata = CASE
                    WHEN t.telegram_data->>'message' IS NOT NULL THEN 
                        jsonb_build_object(
                            'message_type', 'message',
                            'message_id', (t.telegram_data->'message'->>'message_id')::bigint,
                            'date', (t.telegram_data->'message'->>'date')::bigint,
                            'chat', t.telegram_data->'message'->'chat',
                            'from', t.telegram_data->'message'->'from',
                            'media_group_id', t.telegram_data->'message'->>'media_group_id',
                            'text', t.telegram_data->'message'->>'text',
                            'caption', t.telegram_data->'message'->>'caption'
                        )
                    WHEN t.telegram_data->>'channel_post' IS NOT NULL THEN
                        jsonb_build_object(
                            'message_type', 'channel_post',
                            'message_id', (t.telegram_data->'channel_post'->>'message_id')::bigint,
                            'date', (t.telegram_data->'channel_post'->>'date')::bigint,
                            'chat', t.telegram_data->'channel_post'->'chat',
                            'media_group_id', t.telegram_data->'channel_post'->>'media_group_id',
                            'text', t.telegram_data->'channel_post'->>'text',
                            'caption', t.telegram_data->'channel_post'->>'caption'
                        )
                    WHEN t.telegram_data->>'edited_message' IS NOT NULL THEN
                        jsonb_build_object(
                            'message_type', 'edited_message',
                            'message_id', (t.telegram_data->'edited_message'->>'message_id')::bigint,
                            'date', (t.telegram_data->'edited_message'->>'date')::bigint,
                            'chat', t.telegram_data->'edited_message'->'chat',
                            'from', t.telegram_data->'edited_message'->'from',
                            'media_group_id', t.telegram_data->'edited_message'->>'media_group_id',
                            'text', t.telegram_data->'edited_message'->>'text',
                            'caption', t.telegram_data->'edited_message'->>'caption',
                            'edit_date', (t.telegram_data->'edited_message'->>'edit_date')::bigint
                        )
                    WHEN t.telegram_data->>'edited_channel_post' IS NOT NULL THEN
                        jsonb_build_object(
                            'message_type', 'edited_channel_post',
                            'message_id', (t.telegram_data->'edited_channel_post'->>'message_id')::bigint,
                            'date', (t.telegram_data->'edited_channel_post'->>'date')::bigint,
                            'chat', t.telegram_data->'edited_channel_post'->'chat',
                            'media_group_id', t.telegram_data->'edited_channel_post'->>'media_group_id',
                            'text', t.telegram_data->'edited_channel_post'->>'text',
                            'caption', t.telegram_data->'edited_channel_post'->>'caption',
                            'edit_date', (t.telegram_data->'edited_channel_post'->>'edit_date')::bigint
                        )
                    ELSE t.telegram_data
                END
            FROM to_migrate t
            WHERE m.id = t.id
            RETURNING 1
        )
        SELECT COUNT(*) INTO migrated_batch_count FROM migrated;
        
        -- Update progress counters
        total_migrated := total_migrated + migrated_batch_count;
        current_offset := current_offset + batch_size;
        has_more := migrated_batch_count > 0;
        
        -- Commit current batch to release locks
        COMMIT;
        -- Start new transaction for next batch
        BEGIN;
    END LOOP;
    
    -- Return the total count of migrated records
    RETURN QUERY SELECT total_migrated;
END;
$$;

-- Trigger to handle message updates
CREATE OR REPLACE FUNCTION handle_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set updated_at timestamp
    NEW.updated_at = NOW();
    
    -- Only store the essential metadata when telegram_data is updated
    IF NEW.telegram_data IS DISTINCT FROM OLD.telegram_data AND NEW.telegram_data IS NOT NULL THEN
        NEW.telegram_metadata = CASE
            WHEN NEW.telegram_data->>'message' IS NOT NULL THEN 
                jsonb_build_object(
                    'message_type', 'message',
                    'message_id', (NEW.telegram_data->'message'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'message'->>'date')::bigint,
                    'chat', NEW.telegram_data->'message'->'chat',
                    'from', NEW.telegram_data->'message'->'from',
                    'media_group_id', NEW.telegram_data->'message'->>'media_group_id',
                    'text', NEW.telegram_data->'message'->>'text',
                    'caption', NEW.telegram_data->'message'->>'caption'
                )
            WHEN NEW.telegram_data->>'channel_post' IS NOT NULL THEN
                jsonb_build_object(
                    'message_type', 'channel_post',
                    'message_id', (NEW.telegram_data->'channel_post'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'channel_post'->>'date')::bigint,
                    'chat', NEW.telegram_data->'channel_post'->'chat',
                    'media_group_id', NEW.telegram_data->'channel_post'->>'media_group_id',
                    'text', NEW.telegram_data->'channel_post'->>'text',
                    'caption', NEW.telegram_data->'channel_post'->>'caption'
                )
            WHEN NEW.telegram_data->>'edited_message' IS NOT NULL THEN
                jsonb_build_object(
                    'message_type', 'edited_message',
                    'message_id', (NEW.telegram_data->'edited_message'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'edited_message'->>'date')::bigint,
                    'chat', NEW.telegram_data->'edited_message'->'chat',
                    'from', NEW.telegram_data->'edited_message'->'from',
                    'media_group_id', NEW.telegram_data->'edited_message'->>'media_group_id',
                    'text', NEW.telegram_data->'edited_message'->>'text',
                    'caption', NEW.telegram_data->'edited_message'->>'caption',
                    'edit_date', (NEW.telegram_data->'edited_message'->>'edit_date')::bigint
                )
            WHEN NEW.telegram_data->>'edited_channel_post' IS NOT NULL THEN
                jsonb_build_object(
                    'message_type', 'edited_channel_post',
                    'message_id', (NEW.telegram_data->'edited_channel_post'->>'message_id')::bigint,
                    'date', (NEW.telegram_data->'edited_channel_post'->>'date')::bigint,
                    'chat', NEW.telegram_data->'edited_channel_post'->'chat',
                    'media_group_id', NEW.telegram_data->'edited_channel_post'->>'media_group_id',
                    'text', NEW.telegram_data->'edited_channel_post'->>'text',
                    'caption', NEW.telegram_data->'edited_channel_post'->>'caption',
                    'edit_date', (NEW.telegram_data->'edited_channel_post'->>'edit_date')::bigint
                )
            ELSE NEW.telegram_data
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trg_handle_message_update ON messages;
CREATE TRIGGER trg_handle_message_update
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_message_update();

-- Function to create a consolidated version of a message record for webhooks
CREATE OR REPLACE FUNCTION xdelo_prepare_message_for_webhook(message_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_message record;
    result jsonb;
BEGIN
    -- Get the message record
    SELECT * INTO v_message FROM messages WHERE id = message_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Message not found');
    END IF;
    
    -- Build a consolidated version with essential data
    result := jsonb_build_object(
        'id', v_message.id,
        'telegram_message_id', v_message.telegram_message_id,
        'chat_id', v_message.chat_id,
        'chat_type', v_message.chat_type,
        'chat_title', v_message.chat_title,
        'text', v_message.text,
        'caption', v_message.caption,
        'media_group_id', v_message.media_group_id,
        'file_id', v_message.file_id,
        'file_unique_id', v_message.file_unique_id,
        'mime_type', v_message.mime_type,
        'file_size', v_message.file_size,
        'width', v_message.width,
        'height', v_message.height,
        'duration', v_message.duration,
        'storage_path', v_message.storage_path,
        'public_url', v_message.public_url,
        'is_forward', v_message.is_forward,
        'is_edited', v_message.is_edited,
        'edit_count', v_message.edit_count,
        'message_url', v_message.message_url,
        'created_at', v_message.created_at,
        'updated_at', v_message.updated_at,
        'processing_state', v_message.processing_state,
        'product_name', v_message.product_name,
        'product_code', v_message.product_code,
        'vendor_uid', v_message.vendor_uid,
        'purchase_date', v_message.purchase_date,
        'product_quantity', v_message.product_quantity,
        'notes', v_message.notes
    );
    
    -- Include essential metadata from telegram_metadata but not the entire telegram_data
    IF v_message.telegram_metadata IS NOT NULL THEN
        result := result || jsonb_build_object(
            'metadata', jsonb_build_object(
                'message_type', v_message.telegram_metadata->>'message_type',
                'from', v_message.telegram_metadata->'from',
                'chat', v_message.telegram_metadata->'chat',
                'date', v_message.telegram_metadata->>'date',
                'edit_date', v_message.telegram_metadata->>'edit_date'
            )
        );
    END IF;
    
    RETURN result;
END;
$$;
