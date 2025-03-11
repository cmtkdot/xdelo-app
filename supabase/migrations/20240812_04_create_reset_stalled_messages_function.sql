
-- Start transaction
BEGIN;

-- Consolidated function to reset stalled messages with improved metadata
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages(
  p_time_threshold interval DEFAULT INTERVAL '30 minutes',
  p_limit integer DEFAULT 50
)
RETURNS TABLE(message_id uuid, previous_state text, reset_reason text, processing_time interval)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH updates AS (
    UPDATE messages m
    SET
      processing_state = 'pending',
      processing_attempts = COALESCE(processing_attempts, 0) + 1,
      last_processing_attempt = NOW(),
      error_message = CASE 
        WHEN m.processing_state = 'processing' THEN 'Reset due to stalled processing'
        WHEN m.processing_state = 'pending' AND m.updated_at < NOW() - p_time_threshold THEN 'Reset due to stuck pending state'
        ELSE 'Reset from ' || m.processing_state || ' state'
      END,
      retry_count = COALESCE(retry_count, 0) + 1,
      updated_at = NOW()
    WHERE
      (
        (m.processing_state = 'processing' AND m.processing_started_at < NOW() - p_time_threshold)
        OR (m.processing_state = 'pending' AND m.updated_at < NOW() - p_time_threshold)
        OR (m.processing_state = 'error' AND m.last_error_at < NOW() - INTERVAL '24 hours')
      )
      AND m.caption IS NOT NULL 
      AND m.caption != '' 
      AND m.analyzed_content IS NULL
      AND m.deleted_from_telegram = false
    LIMIT p_limit
    RETURNING 
      m.id,
      m.processing_state,
      CASE 
        WHEN m.processing_state = 'processing' THEN 'stalled_processing' 
        WHEN m.processing_state = 'pending' THEN 'stuck_pending'
        ELSE 'error_state'
      END as reason,
      NOW() - COALESCE(m.processing_started_at, m.updated_at, m.last_error_at) as processing_time
  )
  SELECT u.id, u.processing_state, u.reason, u.processing_time
  FROM updates u;
  
  -- Log the reset operation
  INSERT INTO unified_audit_logs (
    event_type,
    metadata,
    event_timestamp
  ) VALUES (
    'system_reset_stalled_messages',
    jsonb_build_object(
      'reset_count', (SELECT COUNT(*) FROM updates),
      'threshold_minutes', EXTRACT(EPOCH FROM p_time_threshold) / 60,
      'timestamp', NOW()
    ),
    NOW()
  );
END;
$$;

-- Commit transaction
COMMIT;
