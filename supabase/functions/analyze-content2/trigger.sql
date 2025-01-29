-- Create a function to call the Edge Function
CREATE OR REPLACE FUNCTION trigger_analyze_content2()
RETURNS TRIGGER AS $$
BEGIN
  -- Make HTTP request to the Edge Function
  SELECT net.http_post(
    url := CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/analyze-content2'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
    ),
    body := jsonb_build_object('message_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the stored procedure for processing media group analysis
CREATE OR REPLACE FUNCTION process_media_group_analysis(
    p_message_id UUID,
    p_media_group_id TEXT,
    p_analyzed_content JSONB,
    p_processing_completed_at TIMESTAMPTZ,
    p_correlation_id UUID
) RETURNS void AS $$
DECLARE
    v_start_time TIMESTAMPTZ;
    v_group_size INTEGER;
    v_original_caption_id UUID;
BEGIN
    v_start_time := clock_timestamp();

    -- Start transaction
    BEGIN
        -- Get group size for logging
        SELECT COUNT(*) INTO v_group_size
        FROM messages
        WHERE media_group_id = p_media_group_id;

        -- Check if there's already an original caption holder in the group
        SELECT id INTO v_original_caption_id
        FROM messages
        WHERE media_group_id = p_media_group_id
        AND is_original_caption = TRUE
        LIMIT 1;

        -- If we found an original caption holder and it's not our current message,
        -- we're reusing analysis
        IF v_original_caption_id IS NOT NULL AND v_original_caption_id != p_message_id THEN
            -- Update current message to reference the original
            UPDATE messages
            SET analyzed_content = p_analyzed_content,
                processing_state = 'analysis_synced',
                processing_completed_at = p_processing_completed_at,
                error_message = NULL,
                is_original_caption = FALSE,
                group_caption_synced = TRUE,
                message_caption_id = v_original_caption_id
            WHERE id = p_message_id;

            -- Log reuse
            PERFORM log_processing_event(
                'GROUP_ANALYSIS_REUSED',
                p_message_id,
                p_media_group_id,
                EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
                'analysis_synced',
                NULL,
                jsonb_build_object(
                    'original_caption_id', v_original_caption_id,
                    'reuse_type', 'existing_reference'
                ),
                p_correlation_id
            );
        ELSE
            -- This message becomes the original caption holder
            UPDATE messages
            SET analyzed_content = p_analyzed_content,
                processing_state = 'analysis_synced',
                processing_completed_at = p_processing_completed_at,
                error_message = NULL,
                is_original_caption = TRUE,
                group_caption_synced = TRUE,
                message_caption_id = NULL -- Original has no reference
            WHERE id = p_message_id;

            -- Log original update
            PERFORM log_processing_event(
                'GROUP_ORIGINAL_UPDATED',
                p_message_id,
                p_media_group_id,
                EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
                'analysis_synced',
                NULL,
                jsonb_build_object(
                    'group_size', v_group_size,
                    'is_original', true
                ),
                p_correlation_id
            );

            -- Update other messages in the group
            IF p_media_group_id IS NOT NULL THEN
                UPDATE messages
                SET analyzed_content = p_analyzed_content,
                    processing_state = 'analysis_synced',
                    processing_completed_at = p_processing_completed_at,
                    group_caption_synced = TRUE,
                    error_message = NULL,
                    is_original_caption = FALSE,
                    message_caption_id = p_message_id
                WHERE media_group_id = p_media_group_id
                    AND id != p_message_id;

                -- Log group update
                PERFORM log_processing_event(
                    'GROUP_MEMBERS_UPDATED',
                    p_message_id,
                    p_media_group_id,
                    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
                    'analysis_synced',
                    NULL,
                    jsonb_build_object(
                        'group_size', v_group_size,
                        'updated_count', v_group_size - 1
                    ),
                    p_correlation_id
                );
            END IF;
        END IF;

        -- Check if all messages in group are synced
        IF NOT EXISTS (
            SELECT 1 FROM messages
            WHERE media_group_id = p_media_group_id
                AND (group_caption_synced IS NOT TRUE OR processing_state != 'analysis_synced')
        ) THEN
            -- Update all messages to completed state
            UPDATE messages
            SET processing_state = 'completed'
            WHERE media_group_id = p_media_group_id;

            -- Log completion
            PERFORM log_processing_event(
                'GROUP_SYNC_COMPLETED',
                p_message_id,
                p_media_group_id,
                EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
                'completed',
                NULL,
                jsonb_build_object(
                    'group_size', v_group_size,
                    'total_duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
                ),
                p_correlation_id
            );
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Log error
        PERFORM log_processing_event(
            'GROUP_SYNC_ERROR',
            p_message_id,
            p_media_group_id,
            EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER,
            'analysis_failed',
            SQLERRM,
            jsonb_build_object(
                'error_detail', SQLSTATE,
                'group_size', v_group_size
            ),
            p_correlation_id
        );
        -- Raise the error to trigger rollback
        RAISE EXCEPTION 'Failed to process media group: %', SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create or update the trigger
CREATE OR REPLACE TRIGGER analyze_content2_trigger
AFTER INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.processing_state = 'caption_ready')
EXECUTE FUNCTION trigger_analyze_content2();
