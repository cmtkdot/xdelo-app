
-- Run the scheduled processing every 5 minutes
select cron.schedule(
  'process-pending-messages',
  '*/5 * * * *',
  $$
  SELECT * FROM xdelo_run_scheduled_message_processing();
  $$
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
        current_setting('app.settings.supabase_functions_url') || '/functions/v1/direct-caption-processor',
        jsonb_build_object(
          'messageId', id,
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
  $$
  SELECT * FROM xdelo_sync_pending_media_group_messages();
  $$
);
