
-- Add new column for storing only essential telegram metadata
ALTER TABLE messages ADD COLUMN IF NOT EXISTS telegram_metadata JSONB;

-- Create indexes on critical search fields to improve performance
CREATE INDEX IF NOT EXISTS idx_telegram_message_chat ON messages (telegram_message_id, chat_id);
CREATE INDEX IF NOT EXISTS idx_media_group_id ON messages (media_group_id) WHERE media_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_unique_id ON messages (file_unique_id) WHERE file_unique_id IS NOT NULL;

-- Helper function to extract essential metadata from telegram_data
CREATE OR REPLACE FUNCTION xdelo_extract_telegram_metadata(p_telegram_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_telegram_data IS NULL THEN
    RETURN NULL;
  END IF;
  
  IF p_telegram_data->>'message' IS NOT NULL THEN 
    v_result := jsonb_build_object(
      'message_type', 'message',
      'message_id', (p_telegram_data->'message'->>'message_id')::bigint,
      'date', (p_telegram_data->'message'->>'date')::bigint,
      'chat', p_telegram_data->'message'->'chat',
      'from', p_telegram_data->'message'->'from',
      'media_group_id', p_telegram_data->'message'->>'media_group_id',
      'text', p_telegram_data->'message'->>'text',
      'caption', p_telegram_data->'message'->>'caption'
    );
  ELSIF p_telegram_data->>'channel_post' IS NOT NULL THEN
    v_result := jsonb_build_object(
      'message_type', 'channel_post',
      'message_id', (p_telegram_data->'channel_post'->>'message_id')::bigint,
      'date', (p_telegram_data->'channel_post'->>'date')::bigint,
      'chat', p_telegram_data->'channel_post'->'chat',
      'media_group_id', p_telegram_data->'channel_post'->>'media_group_id',
      'text', p_telegram_data->'channel_post'->>'text',
      'caption', p_telegram_data->'channel_post'->>'caption'
    );
  ELSIF p_telegram_data->>'edited_message' IS NOT NULL THEN
    v_result := jsonb_build_object(
      'message_type', 'edited_message',
      'message_id', (p_telegram_data->'edited_message'->>'message_id')::bigint,
      'date', (p_telegram_data->'edited_message'->>'date')::bigint,
      'chat', p_telegram_data->'edited_message'->'chat',
      'from', p_telegram_data->'edited_message'->'from',
      'media_group_id', p_telegram_data->'edited_message'->>'media_group_id',
      'text', p_telegram_data->'edited_message'->>'text',
      'caption', p_telegram_data->'edited_message'->>'caption',
      'edit_date', (p_telegram_data->'edited_message'->>'edit_date')::bigint
    );
  ELSIF p_telegram_data->>'edited_channel_post' IS NOT NULL THEN
    v_result := jsonb_build_object(
      'message_type', 'edited_channel_post',
      'message_id', (p_telegram_data->'edited_channel_post'->>'message_id')::bigint,
      'date', (p_telegram_data->'edited_channel_post'->>'date')::bigint,
      'chat', p_telegram_data->'edited_channel_post'->'chat',
      'media_group_id', p_telegram_data->'edited_channel_post'->>'media_group_id',
      'text', p_telegram_data->'edited_channel_post'->>'text',
      'caption', p_telegram_data->'edited_channel_post'->>'caption',
      'edit_date', (p_telegram_data->'edited_channel_post'->>'edit_date')::bigint
    );
  ELSE
    v_result := p_telegram_data;
  END IF;
  
  RETURN v_result;
END;
$$;

-- One-time data migration (use with caution on large tables)
-- Creates a function that can be called to extract minimal metadata from telegram_data
CREATE OR REPLACE FUNCTION xdelo_migrate_telegram_data_to_metadata()
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
                telegram_metadata = xdelo_extract_telegram_metadata(t.telegram_data)
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

-- Create trigger to automatically extract and store telegram_metadata on update
CREATE OR REPLACE FUNCTION handle_telegram_data_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set updated_at timestamp
    NEW.updated_at := NOW();
    
    -- Only store the essential metadata when telegram_data is updated
    IF NEW.telegram_data IS DISTINCT FROM OLD.telegram_data AND NEW.telegram_data IS NOT NULL THEN
        NEW.telegram_metadata := xdelo_extract_telegram_metadata(NEW.telegram_data);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trg_handle_telegram_data_update ON messages;
CREATE TRIGGER trg_handle_telegram_data_update
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_telegram_data_update();

-- Create a trigger for new inserts to set telegram_metadata
CREATE OR REPLACE FUNCTION handle_telegram_data_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Extract telegram_metadata on insert if telegram_data is present
    IF NEW.telegram_data IS NOT NULL AND NEW.telegram_metadata IS NULL THEN
        NEW.telegram_metadata := xdelo_extract_telegram_metadata(NEW.telegram_data);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the insert trigger
CREATE TRIGGER trg_handle_telegram_data_insert
BEFORE INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION handle_telegram_data_insert();

-- Update existing functions to use telegram_metadata when possible
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
    
    -- Include essential metadata from telegram_metadata
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
