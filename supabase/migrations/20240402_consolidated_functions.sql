-- Consolidated database functions and triggers for Telegram message processing
-- This script consolidates and optimizes the database functions related to
-- message processing, media group synchronization, and audit logging

-- ==========================================
-- PART 1: Helper Functions
-- ==========================================

-- Function to log events in a standardized way
CREATE OR REPLACE FUNCTION xdelo_log_event(
  p_event_type TEXT,
  p_entity_id TEXT,
  p_correlation_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO unified_audit_logs (
    id, 
    event_type, 
    entity_id, 
    metadata, 
    correlation_id, 
    error_message
  ) VALUES (
    gen_random_uuid(), 
    p_event_type, 
    p_entity_id, 
    p_metadata, 
    p_correlation_id, 
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a message exists by chat_id and telegram_message_id
CREATE OR REPLACE FUNCTION xdelo_check_message_exists(
  p_chat_id BIGINT,
  p_telegram_message_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM messages 
    WHERE chat_id = p_chat_id 
    AND telegram_message_id = p_telegram_message_id
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update message processing state with logging
CREATE OR REPLACE FUNCTION xdelo_update_message_state(
  p_message_id UUID,
  p_new_state text,
  p_correlation_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_old_state text;
  v_log_metadata JSONB;
BEGIN
  -- Get current state for logging
  SELECT processing_state INTO v_old_state
  FROM messages
  WHERE id = p_message_id;
  
  -- Update the state
  UPDATE messages
  SET 
    processing_state = p_new_state,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- If transitioning to completed, set completion timestamp
  IF p_new_state = 'completed' THEN
    UPDATE messages
    SET processing_completed_at = NOW()
    WHERE id = p_message_id;
  END IF;
  
  -- If transitioning to processing, set start timestamp
  IF p_new_state = 'processing' THEN
    UPDATE messages
    SET processing_started_at = NOW()
    WHERE id = p_message_id;
  END IF;
  
  -- Build log metadata
  v_log_metadata := jsonb_build_object(
    'previous_state', v_old_state,
    'new_state', p_new_state,
    'timestamp', NOW()
  );
  
  -- Combine with provided metadata
  IF p_metadata IS NOT NULL THEN
    v_log_metadata := v_log_metadata || p_metadata;
  END IF;
  
  -- Log the state change
  PERFORM xdelo_log_event(
    'message_state_changed',
    p_message_id::text,
    p_correlation_id,
    v_log_metadata
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 2: Core Processing Functions
-- ==========================================

-- Optimized media group synchronization function
CREATE OR REPLACE FUNCTION xdelo_sync_media_group(
  p_source_message_id UUID,
  p_media_group_id TEXT,
  p_correlation_id TEXT DEFAULT NULL,
  p_force_sync BOOLEAN DEFAULT FALSE,
  p_sync_edit_history BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_source_message messages;
  v_group_messages UUID[];
  v_synced_count INTEGER := 0;
  v_update_data JSONB;
  v_result JSONB;
  v_lock_key TEXT;
BEGIN
  -- Generate a lock key to prevent concurrent syncs of the same group
  v_lock_key := 'media_group_sync_' || p_media_group_id;
  
  -- Try to acquire an advisory lock to prevent concurrent syncs
  IF NOT pg_try_advisory_xact_lock(hashtext(v_lock_key)) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'error', 'Could not acquire lock for media group synchronization'
    );
  END IF;
  
  -- Get the source message
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id;
  
  IF v_source_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'error', 'Source message not found'
    );
  END IF;

  -- Check if source message has analyzed content
  IF v_source_message.analyzed_content IS NULL AND NOT p_force_sync THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'error', 'Source message has no analyzed content'
    );
  END IF;

  -- Mark source message as original caption holder
  UPDATE messages
  SET 
    is_original_caption = TRUE,
    group_caption_synced = TRUE,
    updated_at = NOW()
  WHERE id = p_source_message_id;

  -- Get all other messages in the media group
  SELECT ARRAY_AGG(id) INTO v_group_messages
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND id != p_source_message_id;

  -- If no other messages in group, return success with 0 synced
  IF v_group_messages IS NULL OR ARRAY_LENGTH(v_group_messages, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'synced_count', 0,
      'media_group_id', p_media_group_id
    );
  END IF;
  
  -- Prepare the update data
  v_update_data := jsonb_build_object(
    'analyzed_content', v_source_message.analyzed_content,
    'message_caption_id', p_source_message_id,
    'is_original_caption', FALSE,
    'group_caption_synced', TRUE,
    'processing_state', 'completed',
    'processing_completed_at', NOW(),
    'updated_at', NOW()
  );
  
  -- Add edit history if requested
  IF p_sync_edit_history AND v_source_message.edit_history IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('edit_history', v_source_message.edit_history);
  END IF;
  
  IF p_sync_edit_history AND v_source_message.old_analyzed_content IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('old_analyzed_content', v_source_message.old_analyzed_content);
  END IF;
  
  -- Update all messages in the group
  WITH updated_messages AS (
    UPDATE messages
    SET 
      analyzed_content = v_update_data->>'analyzed_content',
      message_caption_id = (v_update_data->>'message_caption_id')::uuid,
      is_original_caption = (v_update_data->>'is_original_caption')::boolean,
      group_caption_synced = (v_update_data->>'group_caption_synced')::boolean,
      processing_state = v_update_data->>'processing_state',
      processing_completed_at = NOW(),
      updated_at = NOW(),
      edit_history = CASE WHEN p_sync_edit_history THEN 
                       v_source_message.edit_history
                     ELSE 
                       edit_history 
                     END,
      old_analyzed_content = CASE WHEN p_sync_edit_history THEN 
                               v_source_message.old_analyzed_content
                             ELSE 
                               old_analyzed_content 
                             END
    WHERE id = ANY(v_group_messages)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_synced_count FROM updated_messages;
  
  -- Log the sync operation
  PERFORM xdelo_log_event(
    'media_group_synced',
    p_source_message_id::TEXT,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'synced_count', v_synced_count,
      'sync_edit_history', p_sync_edit_history
    )
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', TRUE,
    'synced_count', v_synced_count,
    'media_group_id', p_media_group_id
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  PERFORM xdelo_log_event(
    'media_group_sync_error',
    p_source_message_id::TEXT,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'error', SQLERRM
    ),
    SQLERRM
  );
  
  -- Return error result
  RETURN jsonb_build_object(
    'success', FALSE,
    'synced_count', 0,
    'media_group_id', p_media_group_id,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and maintain media group consistency
CREATE OR REPLACE FUNCTION xdelo_check_media_group_consistency(
  p_media_group_id TEXT,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_message_count INTEGER;
  v_caption_message UUID;
  v_inconsistent_count INTEGER;
  v_result JSONB;
BEGIN
  -- Get total count of messages in the group
  SELECT COUNT(*) INTO v_message_count
  FROM messages
  WHERE media_group_id = p_media_group_id;
  
  -- Get the message with original caption (should be exactly one)
  SELECT id INTO v_caption_message
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND is_original_caption = TRUE;
  
  -- Count messages with inconsistent state
  SELECT COUNT(*) INTO v_inconsistent_count
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND (
    (is_original_caption IS NULL) OR
    (group_caption_synced = FALSE) OR
    (message_caption_id IS NULL AND is_original_caption = FALSE)
  );
  
  -- Build result object
  v_result := jsonb_build_object(
    'media_group_id', p_media_group_id,
    'message_count', v_message_count,
    'has_caption_holder', v_caption_message IS NOT NULL,
    'inconsistent_count', v_inconsistent_count,
    'needs_repair', v_inconsistent_count > 0 OR v_caption_message IS NULL
  );
  
  -- If needs repair and we have a caption message, try to sync
  IF v_result->>'needs_repair' = 'true' AND v_caption_message IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'repair_result', 
      xdelo_sync_media_group(
        v_caption_message, 
        p_media_group_id,
        p_correlation_id,
        TRUE
      )
    );
  END IF;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle message edits
CREATE OR REPLACE FUNCTION xdelo_handle_message_edit(
  p_message_id UUID,
  p_new_caption TEXT DEFAULT NULL,
  p_new_text TEXT DEFAULT NULL,
  p_edit_date TIMESTAMPTZ DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_message messages;
  v_content_changed BOOLEAN := FALSE;
  v_edit_history JSONB[];
  v_result JSONB;
BEGIN
  -- Get current message data
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Message not found'
    );
  END IF;
  
  -- Check if content has changed
  IF (v_message.caption IS DISTINCT FROM p_new_caption AND p_new_caption IS NOT NULL) OR
     (v_message.text IS DISTINCT FROM p_new_text AND p_new_text IS NOT NULL) THEN
    v_content_changed := TRUE;
  END IF;
  
  -- Prepare edit history entry
  v_edit_history := COALESCE(v_message.edit_history, ARRAY[]::JSONB[]);
  v_edit_history := v_edit_history || jsonb_build_object(
    'timestamp', COALESCE(p_edit_date, NOW()),
    'previous_text', v_message.text,
    'previous_caption', v_message.caption,
    'new_text', p_new_text,
    'new_caption', p_new_caption
  );
  
  -- Update the message
  UPDATE messages
  SET
    caption = COALESCE(p_new_caption, caption),
    text = COALESCE(p_new_text, text),
    edit_date = COALESCE(p_edit_date, NOW()),
    edit_history = v_edit_history,
    edit_count = COALESCE(edit_count, 0) + 1,
    is_edited = TRUE,
    updated_at = NOW(),
    -- If content changed, reset analysis
    analyzed_content = CASE WHEN v_content_changed THEN NULL ELSE analyzed_content END,
    old_analyzed_content = CASE 
      WHEN v_content_changed AND analyzed_content IS NOT NULL THEN 
        COALESCE(old_analyzed_content, ARRAY[]::JSONB[]) || analyzed_content
      ELSE 
        old_analyzed_content 
      END,
    processing_state = CASE WHEN v_content_changed THEN 'pending' ELSE processing_state END,
    group_caption_synced = CASE WHEN v_content_changed THEN FALSE ELSE group_caption_synced END
  WHERE id = p_message_id;
  
  -- Log the edit
  PERFORM xdelo_log_event(
    'message_edited',
    p_message_id::TEXT,
    p_correlation_id,
    jsonb_build_object(
      'content_changed', v_content_changed,
      'edit_count', COALESCE(v_message.edit_count, 0) + 1
    )
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message_id', p_message_id,
    'content_changed', v_content_changed,
    'needs_reanalysis', v_content_changed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to repair stalled messages
CREATE OR REPLACE FUNCTION xdelo_reset_stalled_messages(
  p_older_than_minutes INTEGER DEFAULT 30,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_reset_count INTEGER;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff time
  v_cutoff_time := NOW() - (p_older_than_minutes * INTERVAL '1 minute');
  
  -- Reset stalled messages in 'processing' state
  WITH reset_messages AS (
    UPDATE messages
    SET
      processing_state = 'pending',
      updated_at = NOW(),
      retry_count = COALESCE(retry_count, 0) + 1,
      last_error_at = NOW()
    WHERE 
      processing_state = 'processing'
      AND updated_at < v_cutoff_time
    RETURNING id
  )
  SELECT COUNT(*) INTO v_reset_count FROM reset_messages;
  
  -- Log the reset operation
  PERFORM xdelo_log_event(
    'stalled_messages_reset',
    'system',
    p_correlation_id,
    jsonb_build_object(
      'reset_count', v_reset_count,
      'cutoff_time', v_cutoff_time,
      'older_than_minutes', p_older_than_minutes
    )
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'reset_count', v_reset_count,
    'cutoff_time', v_cutoff_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 3: Triggers
-- ==========================================

-- Trigger function to check media group on message change
CREATE OR REPLACE FUNCTION trg_check_media_group_on_message_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is a media group message
  IF NEW.media_group_id IS NOT NULL THEN
    -- If this is a newly analyzed message with content
    IF (OLD.analyzed_content IS NULL AND NEW.analyzed_content IS NOT NULL) OR
       (OLD.group_caption_synced = FALSE AND NEW.group_caption_synced = FALSE AND NEW.analyzed_content IS NOT NULL) OR
       (OLD.processing_state != 'completed' AND NEW.processing_state = 'completed' AND NEW.analyzed_content IS NOT NULL) THEN
       
      -- This message should be the original caption holder
      NEW.is_original_caption := TRUE;
      
      -- Queue a background job to sync the media group
      -- This is done with an HTTP call to maintain non-blocking behavior
      PERFORM http_request(
        'POST',
        CONCAT(current_setting('app.supabase_url'), '/functions/v1/sync-media-group'),
        ARRAY[
          CONCAT('Authorization: Bearer ', current_setting('app.supabase_service_role_key'))
        ]::text[],
        'application/json',
        jsonb_build_object(
          'mediaGroupId', NEW.media_group_id,
          'sourceMessageId', NEW.id,
          'correlationId', NEW.correlation_id
        )::text
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to track forward changes
CREATE OR REPLACE FUNCTION trg_audit_forward_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if the forward status changed
  IF OLD.is_forward IS DISTINCT FROM NEW.is_forward THEN
    PERFORM xdelo_log_event(
      'forward_status_changed',
      NEW.id::TEXT,
      NEW.correlation_id,
      jsonb_build_object(
        'previous_status', OLD.is_forward,
        'new_status', NEW.is_forward
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to ensure edit history consistency in media groups
CREATE OR REPLACE FUNCTION trg_ensure_edit_history_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is part of a media group and edit_history changed
  IF NEW.media_group_id IS NOT NULL AND 
     OLD.edit_history IS DISTINCT FROM NEW.edit_history AND
     NEW.is_original_caption = TRUE THEN
     
    -- Sync edit history to other group members
    UPDATE messages
    SET 
      edit_history = NEW.edit_history,
      updated_at = NOW()
    WHERE 
      media_group_id = NEW.media_group_id
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace triggers
DROP TRIGGER IF EXISTS trg_check_media_group_on_message_change ON messages;
CREATE TRIGGER trg_check_media_group_on_message_change
AFTER UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_check_media_group_on_message_change();

DROP TRIGGER IF EXISTS trg_audit_forward_changes ON messages;
CREATE TRIGGER trg_audit_forward_changes
AFTER UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_audit_forward_changes();

DROP TRIGGER IF EXISTS trg_ensure_edit_history_consistency ON messages;
CREATE TRIGGER trg_ensure_edit_history_consistency
AFTER UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION trg_ensure_edit_history_consistency();

-- ==========================================
-- PART 4: Additional Utility Functions
-- ==========================================

-- Function to get media group statistics
CREATE OR REPLACE FUNCTION xdelo_get_media_group_stats(
  p_media_group_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_stats JSONB;
BEGIN
  SELECT 
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'message_count', COUNT(*),
      'caption_messages', COUNT(*) FILTER (WHERE caption IS NOT NULL),
      'analyzed_messages', COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL),
      'synced_messages', COUNT(*) FILTER (WHERE group_caption_synced = TRUE),
      'original_caption_message', MAX(id) FILTER (WHERE is_original_caption = TRUE),
      'first_message_time', MIN(created_at),
      'last_message_time', MAX(created_at),
      'edit_count', SUM(COALESCE(edit_count, 0)),
      'needs_attention', bool_or(
        processing_state = 'error' OR 
        processing_state = 'processing' OR
        (caption IS NOT NULL AND analyzed_content IS NULL) OR
        (media_group_id IS NOT NULL AND is_original_caption IS NULL)
      )
    )
  INTO v_stats
  FROM messages
  WHERE media_group_id = p_media_group_id;
  
  RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear all messages (for testing/dev purposes)
CREATE OR REPLACE FUNCTION xdelo_clear_all_messages(
  p_confirm TEXT,
  p_correlation_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Safety check to prevent accidental deletion
  IF p_confirm != 'CONFIRM_DELETE_ALL_MESSAGES' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Confirmation string does not match required value'
    );
  END IF;
  
  -- Delete all messages
  WITH deleted AS (
    DELETE FROM messages
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  -- Log the operation
  PERFORM xdelo_log_event(
    'all_messages_cleared',
    'system',
    p_correlation_id,
    jsonb_build_object(
      'deleted_count', v_deleted_count
    )
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'deleted_count', v_deleted_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to locate orphaned media group messages
CREATE OR REPLACE FUNCTION xdelo_find_orphaned_media_group_messages()
RETURNS TABLE (
  media_group_id TEXT,
  message_count INTEGER,
  issues JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH media_groups AS (
    SELECT 
      mg.media_group_id,
      COUNT(*) AS message_count,
      COUNT(*) FILTER (WHERE mg.is_original_caption = TRUE) AS caption_holders,
      bool_or(mg.group_caption_synced = FALSE) AS has_unsynced
    FROM messages mg
    WHERE mg.media_group_id IS NOT NULL
    GROUP BY mg.media_group_id
  )
  SELECT 
    mg.media_group_id,
    mg.message_count,
    jsonb_build_object(
      'missing_caption_holder', mg.caption_holders = 0,
      'multiple_caption_holders', mg.caption_holders > 1,
      'has_unsynced_messages', mg.has_unsynced
    ) AS issues
  FROM media_groups mg
  WHERE mg.caption_holders != 1 OR mg.has_unsynced
  ORDER BY mg.media_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 5: Dashboard Views
-- ==========================================

-- View for message processing statistics
CREATE OR REPLACE VIEW v_message_processing_stats AS
SELECT
  date_trunc('hour', created_at) AS time_period,
  COUNT(*) AS total_messages,
  COUNT(*) FILTER (WHERE processing_state = 'completed') AS completed_messages,
  COUNT(*) FILTER (WHERE processing_state = 'error') AS error_messages,
  COUNT(*) FILTER (WHERE processing_state = 'processing') AS processing_messages,
  COUNT(*) FILTER (WHERE processing_state = 'pending') AS pending_messages,
  COUNT(*) FILTER (WHERE media_group_id IS NOT NULL) AS media_group_messages,
  COUNT(*) FILTER (WHERE is_forward = TRUE) AS forwarded_messages,
  COUNT(*) FILTER (WHERE is_edited = TRUE) AS edited_messages,
  COUNT(DISTINCT media_group_id) FILTER (WHERE media_group_id IS NOT NULL) AS unique_media_groups,
  AVG(CASE 
    WHEN processing_completed_at IS NOT NULL AND processing_started_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at))
    ELSE NULL 
  END) AS avg_processing_time_seconds
FROM
  messages
GROUP BY
  time_period
ORDER BY
  time_period DESC;

-- View for media group consistency check
CREATE OR REPLACE VIEW v_media_group_consistency AS
WITH media_group_stats AS (
  SELECT
    media_group_id,
    COUNT(*) AS message_count,
    COUNT(*) FILTER (WHERE is_original_caption = TRUE) AS caption_holders,
    COUNT(*) FILTER (WHERE group_caption_synced = TRUE) AS synced_messages,
    bool_or(analyzed_content IS NULL AND processing_state = 'completed') AS has_incomplete_analysis,
    COUNT(DISTINCT analyzed_content) AS distinct_analysis_count
  FROM
    messages
  WHERE
    media_group_id IS NOT NULL
  GROUP BY
    media_group_id
)
SELECT
  media_group_id,
  message_count,
  caption_holders,
  synced_messages,
  has_incomplete_analysis,
  distinct_analysis_count,
  CASE
    WHEN caption_holders = 0 THEN 'missing_caption_holder'
    WHEN caption_holders > 1 THEN 'multiple_caption_holders'
    WHEN synced_messages < message_count THEN 'incomplete_sync'
    WHEN has_incomplete_analysis THEN 'incomplete_analysis'
    WHEN distinct_analysis_count > 1 THEN 'inconsistent_analysis'
    ELSE 'consistent'
  END AS consistency_status
FROM
  media_group_stats
ORDER BY
  CASE
    WHEN caption_holders = 0 THEN 0
    WHEN caption_holders > 1 THEN 1
    WHEN synced_messages < message_count THEN 2
    WHEN has_incomplete_analysis THEN 3
    WHEN distinct_analysis_count > 1 THEN 4
    ELSE 5
  END,
  media_group_id;

-- View for message audit trail
CREATE OR REPLACE VIEW v_message_audit_trail AS
SELECT
  al.id AS audit_id,
  al.created_at AS event_time,
  al.event_type,
  al.entity_id,
  al.correlation_id,
  al.metadata,
  al.error_message,
  m.telegram_message_id,
  m.chat_id,
  m.media_group_id
FROM
  unified_audit_logs al
LEFT JOIN
  messages m ON al.entity_id = m.id::TEXT
ORDER BY
  al.created_at DESC; 