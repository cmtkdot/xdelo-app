
-- Run the scheduled processing every 5 minutes
select cron.schedule(
  'process-pending-messages',
  '*/5 * * * *',
  'SELECT * FROM xdelo_run_scheduled_message_processing();'
);

-- Add a new hourly job to look for missing captions
select cron.schedule(
  'retry-unprocessed-messages',
  '30 * * * *',
  $$
  WITH pending_messages AS (
    SELECT id, caption, media_group_id, correlation_id::text
    FROM messages
    WHERE 
      processing_state = 'pending'
      AND caption IS NOT NULL 
      AND caption != ''
      AND analyzed_content IS NULL
      AND updated_at < NOW() - INTERVAL '15 minutes'
    ORDER BY updated_at ASC
    LIMIT 20
  ),
  processed AS (
    SELECT 
      http_post(
        current_setting('app.settings.supabase_functions_url') || '/functions/v1/manual-caption-parser',
        jsonb_build_object(
          'messageId', id,
          'caption', caption,
          'media_group_id', media_group_id,
          'correlationId', correlation_id,
          'trigger_source', 'cron_retry'
        ),
        jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
          'Content-Type', 'application/json'
        )
      ) AS response,
      id
    FROM pending_messages
  )
  INSERT INTO unified_audit_logs (
    event_type,
    metadata,
    event_timestamp
  )
  SELECT 
    'cron_retry_triggered',
    jsonb_build_object(
      'retry_count', (SELECT COUNT(*) FROM pending_messages),
      'timestamp', NOW()
    ),
    NOW();
  $$
);

-- Check for orphaned media groups every hour
select cron.schedule(
  'check-orphaned-media-groups',
  '15 * * * *',
  'SELECT * FROM xdelo_sync_pending_media_group_messages();'
);

-- Add a new job to reset stalled messages every 15 minutes
select cron.schedule(
  'reset-stalled-messages',
  '*/15 * * * *',
  $$
  WITH reset_messages AS (
    SELECT * FROM xdelo_reset_stalled_messages()
  )
  INSERT INTO unified_audit_logs (
    event_type,
    metadata,
    event_timestamp
  )
  SELECT 
    'cron_reset_stalled_triggered',
    jsonb_build_object(
      'reset_count', (SELECT COUNT(*) FROM reset_messages),
      'timestamp', NOW()
    ),
    NOW();
  $$
);

-- Add a new job to cleanup old logs and maintenance tasks weekly
select cron.schedule(
  'maintenance-cleanup',
  '0 1 * * 0', -- Run at 1 AM every Sunday
  $$
  -- Cleanup old audit logs (older than 30 days)
  DELETE FROM unified_audit_logs
  WHERE event_timestamp < NOW() - INTERVAL '30 days';
  
  -- Cleanup old queue entries
  WITH deleted AS (
    DELETE FROM message_processing_queue
    WHERE 
      (status = 'completed' AND processing_completed_at < NOW() - INTERVAL '7 days')
      OR (status = 'error' AND last_error_at < NOW() - INTERVAL '7 days')
    RETURNING id
  )
  INSERT INTO unified_audit_logs (
    event_type,
    metadata,
    event_timestamp
  )
  SELECT 
    'queue_cleanup',
    jsonb_build_object(
      'deleted_count', (SELECT COUNT(*) FROM deleted),
      'timestamp', NOW()
    ),
    NOW();
  $$
);
