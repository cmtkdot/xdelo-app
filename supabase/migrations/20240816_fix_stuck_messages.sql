
-- Add the partial_success state to the processing_state enum if it doesn't exist
DO $$
BEGIN
    -- Check if the enum type exists
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_state') THEN
        -- Check if the value already exists in the enum
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'processing_state')
            AND enumlabel = 'partial_success'
        ) THEN
            -- Add the new value to the enum
            ALTER TYPE processing_state ADD VALUE 'partial_success';
        END IF;
    ELSE
        -- Create the enum if it doesn't exist
        CREATE TYPE processing_state AS ENUM (
            'initialized', 'pending', 'processing', 'completed', 'partial_success', 'error'
        );
    END IF;
END$$;

-- Function to reset messages stuck in processing state
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages(
    p_minutes_threshold integer DEFAULT 15,
    p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_reset_count integer;
    v_correlation_id text;
    v_result jsonb;
BEGIN
    -- Generate correlation ID if not provided
    v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::text);
    
    -- Reset messages stuck in processing state longer than threshold
    WITH updated_messages AS (
        UPDATE messages
        SET 
            processing_state = 'pending',
            error_message = COALESCE(error_message, '') || ' Reset after being stuck in processing state.',
            retry_count = COALESCE(retry_count, 0) + 1,
            processing_started_at = NULL,
            updated_at = NOW()
        WHERE 
            processing_state = 'processing'
            AND processing_started_at < NOW() - (p_minutes_threshold * INTERVAL '1 minute')
            AND deleted_from_telegram = false
        RETURNING id
    )
    SELECT COUNT(*) INTO v_reset_count FROM updated_messages;
    
    -- Log the reset operation
    INSERT INTO unified_audit_logs (
        event_type,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'stalled_messages_reset',
        v_correlation_id,
        jsonb_build_object(
            'reset_count', v_reset_count,
            'minutes_threshold', p_minutes_threshold,
            'operation', 'reset_stalled'
        ),
        NOW()
    );
    
    -- Update media groups with mixed states
    WITH mixed_media_groups AS (
        SELECT 
            media_group_id
        FROM messages
        WHERE 
            media_group_id IS NOT NULL
            AND deleted_from_telegram = false
        GROUP BY media_group_id
        HAVING 
            COUNT(*) FILTER (WHERE processing_state = 'completed' OR processing_state = 'partial_success') > 0
            AND COUNT(*) FILTER (WHERE processing_state = 'pending') > 0
    ),
    media_group_fixes AS (
        SELECT 
            mg.media_group_id,
            (SELECT id FROM messages 
             WHERE media_group_id = mg.media_group_id 
             AND (processing_state = 'completed' OR processing_state = 'partial_success')
             AND analyzed_content IS NOT NULL
             ORDER BY is_original_caption DESC, created_at ASC
             LIMIT 1) as source_message_id
        FROM mixed_media_groups mg
    ),
    applied_fixes AS (
        SELECT 
            f.media_group_id,
            f.source_message_id,
            xdelo_sync_media_group_content(
                f.source_message_id, 
                f.media_group_id, 
                v_correlation_id,
                true,  -- force_sync
                false  -- sync_edit_history
            ) as sync_result
        FROM media_group_fixes f
        WHERE f.source_message_id IS NOT NULL
    )
    SELECT 
        jsonb_build_object(
            'mixed_groups_fixed', COUNT(*),
            'details', jsonb_agg(jsonb_build_object(
                'media_group_id', media_group_id,
                'source_message_id', source_message_id,
                'result', sync_result
            ))
        )
    INTO v_result
    FROM applied_fixes;
    
    RETURN jsonb_build_object(
        'success', true,
        'reset_count', v_reset_count,
        'mixed_media_groups', COALESCE(v_result, jsonb_build_object('mixed_groups_fixed', 0)),
        'correlation_id', v_correlation_id,
        'timestamp', NOW()
    );
END;
$function$;

-- Update transaction functions to better handle media group synchronization
CREATE OR REPLACE FUNCTION public.xdelo_begin_transaction()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_transaction_id text;
BEGIN
    v_transaction_id := gen_random_uuid()::text;
    
    -- Store the transaction ID in a temporary table for the session
    CREATE TEMP TABLE IF NOT EXISTS current_transaction (
        id text PRIMARY KEY,
        created_at timestamptz DEFAULT now()
    ) ON COMMIT DROP;
    
    -- Clear any existing transaction and store the new one
    DELETE FROM current_transaction;
    INSERT INTO current_transaction (id) VALUES (v_transaction_id);
    
    RETURN jsonb_build_object(
        'transaction_id', v_transaction_id,
        'started_at', now()
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.xdelo_commit_transaction_with_sync()
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
    v_transaction_id text;
    v_result jsonb;
BEGIN
    -- Get the current transaction ID
    SELECT id INTO v_transaction_id FROM current_transaction LIMIT 1;
    
    IF v_transaction_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No active transaction found',
            'committed_at', now()
        );
    END IF;
    
    -- Clean up the transaction record
    DELETE FROM current_transaction WHERE id = v_transaction_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'committed_at', now()
    );
END;
$function$;

-- Update media group sync to set correct state
CREATE OR REPLACE FUNCTION public.xdelo_update_message_with_analyzed_content(
    p_message_id uuid,
    p_analyzed_content jsonb,
    p_processing_state text DEFAULT 'completed',
    p_is_edit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_message messages;
    v_old_content jsonb[] := ARRAY[]::jsonb[];
    v_result jsonb;
BEGIN
    -- Get the current message state
    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Message not found',
            'message_id', p_message_id
        );
    END IF;
    
    -- Prepare old content for edits
    IF p_is_edit AND v_message.analyzed_content IS NOT NULL THEN
        v_old_content := COALESCE(v_message.old_analyzed_content, ARRAY[]::jsonb[]);
        v_old_content := array_append(v_old_content, v_message.analyzed_content);
    END IF;
    
    -- Update the message
    UPDATE messages
    SET 
        analyzed_content = p_analyzed_content,
        processing_state = p_processing_state::processing_state,
        processing_completed_at = NOW(),
        old_analyzed_content = CASE WHEN p_is_edit THEN v_old_content ELSE old_analyzed_content END,
        -- For media groups, mark as original caption
        is_original_caption = CASE WHEN v_message.media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
        group_caption_synced = true,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    v_result := jsonb_build_object(
        'success', true,
        'message_id', p_message_id,
        'processing_state', p_processing_state,
        'is_edit', p_is_edit
    );
    
    -- If media group present, initiate sync
    IF v_message.media_group_id IS NOT NULL THEN
        v_result := jsonb_set(
            v_result,
            '{media_group_sync}',
            xdelo_sync_media_group_content(
                p_message_id,
                v_message.media_group_id,
                gen_random_uuid()::text,
                true,  -- force_sync
                p_is_edit  -- sync_edit_history for edits
            )
        );
    END IF;
    
    RETURN v_result;
END;
$function$;

-- Add a scheduler job to reset stalled messages
SELECT cron.schedule(
    'reset-stalled-messages',
    '*/15 * * * *',  -- Every 15 minutes
    $$ SELECT xdelo_reset_stalled_messages(15, 'scheduled_reset_' || gen_random_uuid()::text); $$
);

-- Create a function to handle failed caption analysis
CREATE OR REPLACE FUNCTION public.xdelo_handle_failed_caption_analysis(
    p_message_id uuid,
    p_error_message text,
    p_correlation_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_message messages;
    v_correlation_id text;
    v_retry_count int;
    v_result jsonb;
BEGIN
    -- Generate correlation ID if not provided
    v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::text);
    
    -- Get the current message
    SELECT * INTO v_message FROM messages WHERE id = p_message_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Message not found',
            'message_id', p_message_id
        );
    END IF;
    
    -- Increment retry count
    v_retry_count := COALESCE(v_message.retry_count, 0) + 1;
    
    -- Update the message with error information
    UPDATE messages
    SET 
        processing_state = 'error',
        error_message = p_error_message,
        retry_count = v_retry_count,
        last_error_at = NOW(),
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        error_message,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'caption_analysis_error',
        p_message_id,
        p_error_message,
        v_correlation_id,
        jsonb_build_object(
            'retry_count', v_retry_count,
            'has_caption', v_message.caption IS NOT NULL,
            'caption_length', length(COALESCE(v_message.caption, '')),
            'media_group_id', v_message.media_group_id
        ),
        NOW()
    );
    
    -- Queue for retry if under max retries
    IF v_retry_count < 3 THEN
        -- Calculate exponential backoff
        DECLARE
            v_retry_delay int := power(2, v_retry_count) * 60; -- 2^retry * 60 seconds
        BEGIN
            -- Queue with appropriate priority
            PERFORM xdelo_queue_message_for_processing(
                p_message_id,
                v_correlation_id,
                5 - v_retry_count, -- Lower priority with more retries
                v_retry_delay
            );
            
            v_result := jsonb_build_object(
                'success', false,
                'error', p_error_message,
                'message_id', p_message_id,
                'retry_scheduled', true,
                'retry_count', v_retry_count,
                'retry_delay_seconds', v_retry_delay
            );
        END;
    ELSE
        -- Max retries reached, give up but try to extract partial content
        IF v_message.caption IS NOT NULL THEN
            -- Try to extract at least product name
            DECLARE
                v_partial_content jsonb;
            BEGIN
                v_partial_content := jsonb_build_object(
                    'product_name', regexp_replace(v_message.caption, '#.*|x\d+.*', '', 'gi'),
                    'parsing_metadata', jsonb_build_object(
                        'method', 'fallback',
                        'timestamp', now(),
                        'partial_success', true,
                        'error', 'Created after max retries',
                        'missing_fields', array['product_code', 'vendor_uid', 'purchase_date', 'quantity']
                    ),
                    'caption', v_message.caption
                );
                
                -- Update with fallback partial content
                UPDATE messages
                SET 
                    analyzed_content = v_partial_content,
                    processing_state = 'partial_success',
                    updated_at = NOW()
                WHERE id = p_message_id;
                
                v_result := jsonb_build_object(
                    'success', false,
                    'error', p_error_message,
                    'message_id', p_message_id,
                    'max_retries_reached', true,
                    'fallback_partial_content', true
                );
            END;
        ELSE
            v_result := jsonb_build_object(
                'success', false,
                'error', p_error_message,
                'message_id', p_message_id,
                'max_retries_reached', true,
                'fallback_partial_content', false
            );
        END IF;
    END IF;
    
    RETURN COALESCE(v_result, jsonb_build_object(
        'success', false,
        'error', p_error_message,
        'message_id', p_message_id
    ));
END;
$function$;
