
-- Fix for error column naming issues

-- 1. Update the compatibility view to correctly handle error column naming
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
    error_message AS error,  -- Map error_message to error for compatibility
    error_message,           -- Also keep the original column name
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

-- 2. Update the message_processing_queue functions to use the correct error column name
CREATE OR REPLACE FUNCTION xdelo_fail_message_processing(p_queue_id uuid, p_error text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_message_id UUID;
    v_correlation_id UUID;
    v_attempts INT;
    v_max_attempts INT;
BEGIN
    -- Get the necessary data
    SELECT message_id, correlation_id, attempts, max_attempts
    INTO v_message_id, v_correlation_id, v_attempts, v_max_attempts
    FROM message_processing_queue
    WHERE id = p_queue_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Queue record not found: %', p_queue_id;
    END IF;
    
    -- Update the queue record
    UPDATE message_processing_queue
    SET 
        status = CASE WHEN v_attempts >= v_max_attempts THEN 'failed' ELSE 'pending' END,
        error = p_error,
        last_error_at = NOW(),
        metadata = metadata || jsonb_build_object('last_error', p_error)
    WHERE id = p_queue_id;
    
    -- Update the message state - use error_message, not error
    UPDATE messages
    SET 
        processing_state = CASE WHEN v_attempts >= v_max_attempts THEN 'error' ELSE 'pending' END,
        error_message = p_error,
        last_error_at = NOW(),
        retry_count = COALESCE(retry_count, 0) + 1,
        updated_at = NOW()
    WHERE id = v_message_id;
    
    -- Log the failure
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        CASE WHEN v_attempts >= v_max_attempts THEN 'message_processing_failed' ELSE 'message_processing_retry' END,
        v_message_id,
        v_correlation_id,
        p_error,
        jsonb_build_object(
            'queue_id', p_queue_id,
            'attempts', v_attempts,
            'max_attempts', v_max_attempts
        ),
        NOW()
    );
    
    RETURN TRUE;
END;
$function$;
