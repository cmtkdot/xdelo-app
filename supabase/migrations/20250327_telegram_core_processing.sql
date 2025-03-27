CREATE OR REPLACE FUNCTION public.process_telegram_message(
  p_message_id UUID,
  p_correlation_id TEXT DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_message messages;
  v_caption TEXT;
  v_media_group_id TEXT;
  v_correlation_uuid UUID;
  v_request_id TEXT;
  v_processing_result JSONB;
BEGIN
  -- Generate/validate correlation ID
  v_correlation_uuid := COALESCE(
    NULLIF(p_correlation_id, '')::UUID,
    gen_random_uuid()
  );

  -- Get message with FOR UPDATE lock
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Message not found',
      'message_id', p_message_id
    );
  END IF;

  -- Skip processing if already completed and not forced
  IF NOT p_force AND v_message.processing_state = 'completed' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Message already processed',
      'message_id', p_message_id,
      'status', 'skipped'
    );
  END IF;

  -- Prepare message for processing
  UPDATE messages
  SET
    processing_state = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'correlation_id', v_correlation_uuid,
      'force_reprocess', p_force,
      'processing_attempts', COALESCE((metadata->>'processing_attempts')::INT, 0) + 1
    )
  WHERE id = p_message_id;

  -- Process caption if exists
  IF v_message.caption IS NOT NULL AND v_message.caption <> '' THEN
    v_processing_result := process_message_caption(
      p_message_id := p_message_id,
      p_caption := v_message.caption,
      p_correlation_id := v_correlation_uuid
    );

    IF NOT (v_processing_result->>'success')::BOOLEAN THEN
      RAISE EXCEPTION 'Caption processing failed: %', (v_processing_result->>'error');
    END IF;
  END IF;

  -- Handle media group sync if needed
  IF v_message.media_group_id IS NOT NULL THEN
    v_processing_result := sync_media_group(
      p_message_id := p_message_id,
      p_correlation_id := v_correlation_uuid
    );

    IF NOT (v_processing_result->>'success')::BOOLEAN THEN
      RAISE EXCEPTION 'Media group sync failed: %', (v_processing_result->>'error');
    END IF;
  END IF;

  -- Mark processing as complete
  UPDATE messages
  SET
    processing_state = 'completed',
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Message processed successfully',
    'message_id', p_message_id,
    'correlation_id', v_correlation_uuid
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Error handling
    UPDATE messages
    SET
      processing_state = 'error',
      error_message = SQLERRM,
      updated_at = NOW()
    WHERE id = p_message_id;

    -- Log error
    PERFORM log_processing_error(
      p_message_id := p_message_id,
      p_error_message := SQLERRM,
      p_correlation_id := v_correlation_uuid
    );

    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Message processing failed',
      'message_id', p_message_id,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

/**
 * Process message caption and extract structured data
 */
CREATE OR REPLACE FUNCTION public.process_message_caption(
  p_message_id UUID,
  p_caption TEXT,
  p_correlation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_analyzed_content JSONB;
BEGIN
  -- Call caption parser (implemented in edge function)
  SELECT * INTO v_analyzed_content
  FROM parse_caption(p_caption);

  -- Update message with analyzed content
  UPDATE messages
  SET
    analyzed_content = v_analyzed_content,
    updated_at = NOW()
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Caption processed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Synchronize media group content
 */
CREATE OR REPLACE FUNCTION public.sync_media_group(
  p_message_id UUID,
  p_correlation_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_message messages;
  v_media_group_id TEXT;
  v_lock_key BIGINT;
  v_update_count INT;
BEGIN
  -- Get message details
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;

  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Source message not found'
    );
  END IF;

  v_media_group_id := v_message.media_group_id;
  IF v_media_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Message is not part of a media group'
    );
  END IF;

  -- Create lock key based on media_group_id
  v_lock_key := ('x' || md5(v_media_group_id))::bit(64)::bigint;

  -- Acquire advisory lock
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Media group sync already in progress',
      'retry_suggested', TRUE
    );
  END IF;

  -- Sync content to other messages in group
  UPDATE messages
  SET
    analyzed_content = v_message.analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    updated_at = NOW(),
    is_original_caption = FALSE,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'synced_from', p_message_id,
      'sync_correlation_id', p_correlation_id
    )
  WHERE
    media_group_id = v_media_group_id
    AND id != p_message_id
    AND (
      analyzed_content IS NULL
      OR analyzed_content IS DISTINCT FROM v_message.analyzed_content
    );

  GET DIAGNOSTICS v_update_count = ROW_COUNT;

  -- Mark source as original
  UPDATE messages
  SET is_original_caption = TRUE
  WHERE id = p_message_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Media group synchronized',
    'update_count', v_update_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MAINTENANCE FUNCTIONS
-- =============================================

/**
 * Reset stalled messages that have been processing too long
 */
CREATE OR REPLACE FUNCTION public.reset_stalled_messages(
  p_timeout_minutes INT DEFAULT 15
) RETURNS JSONB AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE messages
  SET
    processing_state = 'pending',
    error_message = 'Reset due to timeout',
    updated_at = NOW()
  WHERE
    processing_state = 'processing'
    AND processing_started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', TRUE,
    'reset_count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * Recheck media groups for consistency
 */
CREATE OR REPLACE FUNCTION public.recheck_media_groups() RETURNS JSONB AS $$
DECLARE
  v_groups TEXT[];
  v_group_count INT;
BEGIN
  -- Find groups needing recheck
  SELECT ARRAY_AGG(DISTINCT media_group_id) INTO v_groups
  FROM messages
  WHERE
    media_group_id IS NOT NULL
    AND processing_state IN ('pending', 'processing')
    AND created_at > NOW() - INTERVAL '1 hour';

  v_group_count := COALESCE(array_length(v_groups, 1), 0);

  -- Process each group
  IF v_group_count > 0 THEN
    FOR i IN 1..v_group_count LOOP
      PERFORM process_telegram_message(
        p_message_id := id,
        p_correlation_id := 'recheck-' || gen_random_uuid()::TEXT
      )
      FROM messages
      WHERE
        media_group_id = v_groups[i]
        AND processing_state = 'completed'
      LIMIT 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'groups_processed', v_group_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger for new/updated captions
CREATE OR REPLACE FUNCTION public.trigger_caption_processing() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.caption IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.caption IS DISTINCT FROM NEW.caption AND NEW.caption IS NOT NULL) THEN

    NEW.processing_state := 'pending';
    NEW.processing_started_at := NOW();

    -- Preserve history for edits
    IF TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL THEN
      NEW.old_analyzed_content := OLD.analyzed_content;
      NEW.is_edited := TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_process_caption
BEFORE INSERT OR UPDATE OF caption ON messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL)
EXECUTE FUNCTION trigger_caption_processing();

-- Trigger for completed processing
CREATE OR REPLACE FUNCTION public.trigger_processing_complete() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.processing_state = 'completed' AND OLD.processing_state != 'completed' THEN
    -- Extract fields to dedicated columns
    NEW.product_name := NEW.analyzed_content->>'productName';
    NEW.product_code := NEW.analyzed_content->>'productCode';
    NEW.vendor_uid := NEW.analyzed_content->>'vendorUID';
    NEW.purchase_date := (NEW.analyzed_content->>'purchaseDate')::date;
    NEW.quantity := (NEW.analyzed_content->>'quantity')::int;
    NEW.notes := NEW.analyzed_content->>'notes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_processing_complete
BEFORE UPDATE OF processing_state ON messages
FOR EACH ROW
EXECUTE FUNCTION trigger_processing_complete();

-- =============================================
-- SETUP CRON JOBS
-- =============================================

SELECT cron.schedule(
  'recheck-media-groups',
  '* * * * *', -- Every minute
  'SELECT recheck_media_groups()'
);

SELECT cron.schedule(
  'reset-stalled-messages',
  '*/5 * * * *', -- Every 5 minutes
  'SELECT reset_stalled_messages()'
);

COMMIT;
