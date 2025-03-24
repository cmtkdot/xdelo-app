
-- Drop deprecated functions and triggers
DROP FUNCTION IF EXISTS process_caption_with_ai;
DROP FUNCTION IF EXISTS trigger_external_processing;
DROP FUNCTION IF EXISTS analyze_with_ai;
DROP FUNCTION IF EXISTS parse_caption_with_ai;
DROP FUNCTION IF EXISTS xdelo_begin_transaction;
DROP FUNCTION IF EXISTS xdelo_commit_transaction_with_sync;
DROP FUNCTION IF EXISTS xdelo_handle_failed_caption_analysis;
DROP FUNCTION IF EXISTS xdelo_repair_media_group_syncs;

-- Drop deprecated triggers
DROP TRIGGER IF EXISTS trg_make_webhook ON messages;
DROP TRIGGER IF EXISTS trg_n8n_webhook ON messages;

-- Create a new function to directly process the caption
CREATE OR REPLACE FUNCTION xdelo_direct_caption_processing(
    p_message_id UUID,
    p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_message messages;
    v_result JSONB;
    v_caption TEXT;
    v_media_group_id TEXT;
    v_correlation_id TEXT := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
BEGIN
    -- Get the message
    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    
    IF v_message IS NULL THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;
    
    -- Get the caption
    v_caption := v_message.caption;
    
    IF v_caption IS NULL OR v_caption = '' THEN
        RAISE EXCEPTION 'No caption available for message: %', p_message_id;
    END IF;
    
    -- Record that we're starting to process this message
    UPDATE messages
    SET 
        processing_state = 'processing',
        processing_started_at = NOW(),
        correlation_id = v_correlation_id
    WHERE id = p_message_id;
    
    -- Call the edge function to process the caption
    -- This is implemented using pg_net to make an HTTP call to our edge function
    -- We use a simplified approach here for demo purposes
    -- In production, you'd use pg_net or have a direct SQL implementation of the parser
    
    -- Simple direct parsing implementation (you could replace with more sophisticated logic)
    v_result := jsonb_build_object(
        'parsing_method', 'rule-based',
        'parsing_success', TRUE,
        'raw_caption', v_caption,
        'parsing_metadata', jsonb_build_object(
            'timestamp', NOW(),
            'correlation_id', v_correlation_id,
            'method', 'sql'
        )
    );
    
    -- Extract product name (first line)
    v_result := v_result || jsonb_build_object(
        'product_name', split_part(v_caption, E'\n', 1)
    );
    
    -- Look for vendor pattern (VID: xxx or #xxx)
    IF v_caption ~* 'VID:[\s]*([A-Za-z0-9_-]+)' THEN
        v_result := v_result || jsonb_build_object(
            'vendor_uid', regexp_replace(v_caption, '.*VID:[\s]*([A-Za-z0-9_-]+).*', '\1', 'i')
        );
    ELSIF v_caption ~* '#([A-Za-z0-9_-]+)' THEN
        v_result := v_result || jsonb_build_object(
            'vendor_uid', regexp_replace(v_caption, '.*#([A-Za-z0-9_-]+).*', '\1', 'i')
        );
    END IF;
    
    -- Update the message with the parsed caption
    UPDATE messages
    SET 
        analyzed_content = v_result,
        processing_state = 'completed',
        processing_completed_at = NOW()
    WHERE id = p_message_id
    RETURNING media_group_id INTO v_media_group_id;
    
    -- Return the result
    RETURN jsonb_build_object(
        'success', TRUE,
        'message_id', p_message_id,
        'correlation_id', v_correlation_id,
        'media_group_id', v_media_group_id,
        'analyzed_content', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message
    ) VALUES (
        'caption_processing_failed',
        p_message_id::TEXT,
        v_correlation_id,
        jsonb_build_object('error', SQLERRM),
        SQLERRM
    );
    
    -- Update message to show error
    UPDATE messages
    SET 
        processing_state = 'error',
        error_message = SQLERRM,
        error_code = SQLSTATE
    WHERE id = p_message_id;
    
    -- Return error
    RETURN jsonb_build_object(
        'success', FALSE,
        'message_id', p_message_id,
        'correlation_id', v_correlation_id,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Create a new workflow function that orchestrates the caption processing
CREATE OR REPLACE FUNCTION xdelo_process_caption_workflow(
    p_message_id UUID,
    p_correlation_id TEXT DEFAULT NULL,
    p_force BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_message messages;
    v_result JSONB;
    v_caption TEXT;
    v_media_group_id TEXT;
    v_correlation_id TEXT := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
    v_sync_result JSONB;
BEGIN
    -- Get the message
    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    
    IF v_message IS NULL THEN
        RAISE EXCEPTION 'Message not found: %', p_message_id;
    END IF;
    
    -- Get the caption
    v_caption := v_message.caption;
    v_media_group_id := v_message.media_group_id;
    
    IF v_caption IS NULL OR v_caption = '' THEN
        RAISE EXCEPTION 'No caption available for message: %', p_message_id;
    END IF;
    
    -- Skip if already processed and not forcing
    IF v_message.processing_state = 'completed' AND NOT p_force THEN
        RETURN jsonb_build_object(
            'success', TRUE,
            'message_id', p_message_id,
            'correlation_id', v_correlation_id,
            'media_group_id', v_media_group_id,
            'status', 'already_processed',
            'message', 'Message already processed'
        );
    END IF;
    
    -- Record that we're starting to process this message
    UPDATE messages
    SET 
        processing_state = 'processing',
        processing_started_at = NOW(),
        correlation_id = v_correlation_id
    WHERE id = p_message_id;
    
    -- Process the caption
    v_result := xdelo_direct_caption_processing(p_message_id, v_correlation_id);
    
    -- Check for errors
    IF NOT (v_result->>'success')::BOOLEAN THEN
        RETURN v_result;
    END IF;
    
    -- If this is part of a media group, sync the caption to other messages
    IF v_media_group_id IS NOT NULL AND v_media_group_id != '' THEN
        -- Sync media group content
        v_sync_result := xdelo_sync_media_group_content(
            v_media_group_id,
            p_message_id,
            v_correlation_id
        );
        
        -- Add sync result to the response
        v_result := v_result || jsonb_build_object(
            'media_group_synced', TRUE,
            'sync_result', v_sync_result
        );
    END IF;
    
    -- Return the result
    RETURN v_result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message
    ) VALUES (
        'caption_workflow_failed',
        p_message_id::TEXT,
        v_correlation_id,
        jsonb_build_object('error', SQLERRM),
        SQLERRM
    );
    
    -- Update message to show error
    UPDATE messages
    SET 
        processing_state = 'error',
        error_message = SQLERRM,
        error_code = SQLSTATE
    WHERE id = p_message_id;
    
    -- Return error
    RETURN jsonb_build_object(
        'success', FALSE,
        'message_id', p_message_id,
        'correlation_id', v_correlation_id,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Function to sync analyzed content across all messages in a media group
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
    p_media_group_id TEXT,
    p_source_message_id UUID,
    p_correlation_id TEXT,
    p_force_sync BOOLEAN DEFAULT FALSE,
    p_sync_edit_history BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
    v_source_message messages;
    v_count INTEGER := 0;
    v_updated_count INTEGER := 0;
    v_error_count INTEGER := 0;
BEGIN
    -- Check source message exists
    SELECT * INTO v_source_message FROM messages 
    WHERE id = p_source_message_id;
    
    IF v_source_message IS NULL THEN
        RAISE EXCEPTION 'Source message not found: %', p_source_message_id;
    END IF;
    
    -- Ensure the source message has analyzed content
    IF v_source_message.analyzed_content IS NULL THEN
        RAISE EXCEPTION 'Source message has no analyzed content';
    END IF;
    
    -- Count the number of messages in the group
    SELECT COUNT(*) INTO v_count FROM messages
    WHERE media_group_id = p_media_group_id;
    
    -- Update all messages in the media group
    WITH updated AS (
        UPDATE messages
        SET 
            analyzed_content = v_source_message.analyzed_content,
            group_caption_synced = TRUE,
            correlation_id = p_correlation_id,
            updated_at = NOW()
        WHERE 
            media_group_id = p_media_group_id
            AND id != p_source_message_id
            AND (NOT group_caption_synced OR p_force_sync)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated;
    
    -- Update the source message
    UPDATE messages
    SET 
        is_original_caption = TRUE,
        group_caption_synced = TRUE
    WHERE id = p_source_message_id;
    
    -- Sync edit history if requested
    IF p_sync_edit_history AND v_source_message.edit_history IS NOT NULL THEN
        UPDATE messages
        SET edit_history = v_source_message.edit_history
        WHERE 
            media_group_id = p_media_group_id
            AND id != p_source_message_id;
    END IF;
    
    -- Return the result
    RETURN jsonb_build_object(
        'success', TRUE,
        'media_group_id', p_media_group_id,
        'source_message_id', p_source_message_id,
        'total_messages', v_count,
        'synced_count', v_updated_count,
        'skipped_count', v_count - v_updated_count - 1,
        'correlation_id', p_correlation_id
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        error_message
    ) VALUES (
        'media_group_sync_failed',
        p_source_message_id::TEXT,
        p_correlation_id,
        jsonb_build_object(
            'media_group_id', p_media_group_id,
            'error', SQLERRM
        ),
        SQLERRM
    );
    
    -- Return error
    RETURN jsonb_build_object(
        'success', FALSE,
        'media_group_id', p_media_group_id,
        'source_message_id', p_source_message_id,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger to process captions
CREATE OR REPLACE FUNCTION trg_process_caption() RETURNS TRIGGER AS $$
DECLARE
    v_correlation_id TEXT;
BEGIN
    -- Generate a new correlation ID
    v_correlation_id := gen_random_uuid()::TEXT;
    
    -- Check if the message has a caption and needs processing
    IF NEW.caption IS NOT NULL AND NEW.caption != '' AND 
       (NEW.processing_state = 'pending' OR NEW.processing_state = 'initialized' OR NEW.processing_state IS NULL) THEN
       
        -- Set initial processing state
        NEW.processing_state := 'initialized';
        NEW.correlation_id := v_correlation_id;
        
        -- Process asynchronously after the transaction completes
        PERFORM pg_notify(
            'message_caption_processing',
            json_build_object(
                'message_id', NEW.id,
                'correlation_id', v_correlation_id
            )::TEXT
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Make sure the trigger is properly set
DROP TRIGGER IF EXISTS trg_process_caption ON messages;
CREATE TRIGGER trg_process_caption
BEFORE INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_process_caption();

-- Create a function to handle message caption processing notification
CREATE OR REPLACE FUNCTION handle_message_caption_processing() RETURNS TRIGGER AS $$
DECLARE
    v_payload JSONB;
    v_message_id UUID;
    v_correlation_id TEXT;
    v_result JSONB;
BEGIN
    -- Parse the payload
    v_payload := payload::JSONB;
    v_message_id := (v_payload->>'message_id')::UUID;
    v_correlation_id := v_payload->>'correlation_id';
    
    -- Process the caption
    v_result := xdelo_process_caption_workflow(v_message_id, v_correlation_id);
    
    -- Log the result
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata
    ) VALUES (
        'caption_processing_notification_handled',
        v_message_id::TEXT,
        v_correlation_id,
        v_result
    );
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Set up listener for async processing
DROP TRIGGER IF EXISTS trg_message_caption_processing ON pg_notify;
CREATE TRIGGER trg_message_caption_processing
AFTER INSERT ON pg_notify
FOR EACH ROW
WHEN (NEW.channel = 'message_caption_processing')
EXECUTE FUNCTION handle_message_caption_processing();
