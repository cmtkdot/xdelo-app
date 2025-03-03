
-- Create views for compatibility with external tools (e.g., NocoDb) that expect different column names
-- This file creates views that map existing columns to expected query column names

-- 1. Create a view that maps message columns to the expected names in queries
CREATE OR REPLACE VIEW v_messages_compatibility AS
SELECT 
    id,
    telegram_message_id,
    chat_id,
    chat_type,
    chat_title,
    media_group_id,
    is_original_caption,
    group_caption_synced,
    caption,
    file_id,
    file_unique_id,
    public_url,
    mime_type,
    file_size,
    width,
    height,
    duration,
    is_edited,
    edit_history,
    processing_state,
    analyzed_content,
    error_message,
    retry_count,
    user_id,
    telegram_data,
    message_url,
    purchase_order,
    glide_row_id,
    processing_correlation_id,
    sync_attempt,
    -- Map existing fields to expected query columns
    product_name AS product_name, -- Keep as is if exists
    product_code AS product_sku,  -- Map to expected column name
    vendor_uid AS vendor_name,    -- Map to expected column name
    product_quantity,
    COALESCE(analyzed_content->>'unit', '') AS product_unit, -- Extract unit from analyzed_content
    is_miscellaneous_item,
    storage_path,
    purchase_date,
    -- Other fields
    (SELECT COUNT(*) FROM messages m2 WHERE m2.media_group_id = messages.media_group_id) AS group_message_count,
    correlation_id,
    edit_date,
    processing_started_at,
    processing_completed_at,
    last_error_at,
    group_first_message_time,
    group_last_message_time,
    created_at,
    updated_at
FROM messages;

-- 2. Create a view for message relationships counts
CREATE OR REPLACE VIEW v_message_relationships AS
SELECT 
    m.id,
    m.telegram_message_id,
    m.media_group_id,
    (SELECT COUNT(*) FROM message_processing_queue q WHERE q.message_id = m.id) AS queue_entries,
    (SELECT COUNT(*) FROM messages m2 WHERE m2.message_caption_id = m.id) AS caption_references,
    (SELECT COUNT(*) FROM other_messages o WHERE o.message_caption_id = m.id) AS other_messages_references,
    (SELECT COUNT(*) FROM webhook_logs w WHERE w.message_id::uuid = m.id) AS webhook_logs_count
FROM messages m;

-- 3. Create an aggregated view that combines both for efficient queries
CREATE OR REPLACE VIEW v_messages_with_relationships AS
SELECT 
    m.*,
    r.queue_entries,
    r.caption_references,
    r.other_messages_references,
    r.webhook_logs_count
FROM v_messages_compatibility m
JOIN v_message_relationships r ON m.id = r.id;

-- 4. Create function to extract useful fields from analyzed_content
CREATE OR REPLACE FUNCTION xdelo_extract_message_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Extract and map fields from analyzed_content to dedicated columns if they don't exist
    NEW.product_name := COALESCE(NEW.product_name, NEW.analyzed_content->>'product_name');
    NEW.product_code := COALESCE(NEW.product_code, NEW.analyzed_content->>'product_code');
    NEW.vendor_uid := COALESCE(NEW.vendor_uid, NEW.analyzed_content->>'vendor_uid');
    
    -- Extract purchase date if it exists in analyzed_content
    IF NEW.purchase_date IS NULL AND NEW.analyzed_content->>'purchase_date' IS NOT NULL THEN
        BEGIN
            NEW.purchase_date := (NEW.analyzed_content->>'purchase_date')::date;
        EXCEPTION WHEN OTHERS THEN
            -- If there's an error parsing the date, don't update
            NULL;
        END;
    END IF;
    
    -- Extract quantity if it exists
    IF NEW.product_quantity IS NULL AND NEW.analyzed_content->>'quantity' IS NOT NULL THEN
        BEGIN
            NEW.product_quantity := (NEW.analyzed_content->>'quantity')::numeric;
        EXCEPTION WHEN OTHERS THEN
            -- If there's an error parsing the number, don't update
            NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 5. Create or replace trigger to automatically extract fields
DROP TRIGGER IF EXISTS trg_extract_message_fields ON messages;
CREATE TRIGGER trg_extract_message_fields
BEFORE INSERT OR UPDATE OF analyzed_content ON messages
FOR EACH ROW
WHEN (NEW.analyzed_content IS NOT NULL)
EXECUTE FUNCTION xdelo_extract_message_fields();

-- 6. Create index for efficient joins in the views
CREATE INDEX IF NOT EXISTS idx_messages_media_group_id ON messages(media_group_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_caption_id ON messages(message_caption_id);
CREATE INDEX IF NOT EXISTS idx_message_processing_queue_message_id ON message_processing_queue(message_id);
CREATE INDEX IF NOT EXISTS idx_other_messages_message_caption_id ON other_messages(message_caption_id);

-- 7. Function to repair missing message caption relationships
CREATE OR REPLACE FUNCTION xdelo_repair_message_relationships()
RETURNS TABLE(media_group_id text, caption_message_id uuid, updated_count integer)
LANGUAGE plpgsql
AS $$
DECLARE
    v_group record;
    v_caption_message_id uuid;
    v_updated_count integer;
BEGIN
    -- Find media groups where messages don't have message_caption_id set
    FOR v_group IN 
        SELECT DISTINCT m.media_group_id
        FROM messages m
        WHERE m.media_group_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM messages m2 
            WHERE m2.media_group_id = m.media_group_id 
            AND m2.message_caption_id IS NULL
        )
        AND EXISTS (
            SELECT 1 FROM messages m3 
            WHERE m3.media_group_id = m.media_group_id 
            AND m3.is_original_caption = true
        )
    LOOP
        -- Find the caption message for this group
        SELECT id INTO v_caption_message_id
        FROM messages
        WHERE media_group_id = v_group.media_group_id
        AND is_original_caption = true
        LIMIT 1;
        
        IF v_caption_message_id IS NOT NULL THEN
            -- Update all messages in the group that don't have message_caption_id set
            UPDATE messages
            SET message_caption_id = v_caption_message_id
            WHERE media_group_id = v_group.media_group_id
            AND message_caption_id IS NULL
            AND id != v_caption_message_id;
            
            GET DIAGNOSTICS v_updated_count = ROW_COUNT;
            
            -- Return the results
            media_group_id := v_group.media_group_id;
            caption_message_id := v_caption_message_id;
            updated_count := v_updated_count;
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;
