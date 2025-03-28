
-- Create a processing_stats table to track processing metrics
CREATE TABLE IF NOT EXISTS processing_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stats_date DATE DEFAULT CURRENT_DATE,
  total_messages INTEGER,
  pending_count INTEGER,
  processing_count INTEGER,
  completed_count INTEGER,
  error_count INTEGER,
  avg_processing_time_ms DOUBLE PRECISION
);

-- Create a cron job to reset stalled messages (every 5 minutes)
SELECT cron.schedule(
  'reset-stalled-messages',
  '*/5 * * * *',  -- every 5 minutes
  $$
  SELECT xdelo_reset_stalled_messages(15);
  $$
);

-- Create a cron job to process pending messages (every minute)
SELECT cron.schedule(
  'process-pending-captions',
  '* * * * *',  -- every minute
  $$
  DO $$
  DECLARE
    v_message RECORD;
    v_correlation_id UUID;
    v_processed INT := 0;
  BEGIN
    -- Process up to 5 pending messages per run
    FOR v_message IN
      SELECT id, caption 
      FROM messages 
      WHERE processing_state = 'pending' 
      AND caption IS NOT NULL
      ORDER BY processing_started_at ASC
      LIMIT 5
    LOOP
      v_correlation_id := gen_random_uuid();
      
      -- Call the parse-caption edge function via http
      PERFORM
        http((
          'POST',
          (SELECT value FROM pg_settings WHERE name = 'supabase_url') || '/functions/v1/parse-caption',
          ARRAY[('Content-Type', 'application/json'), ('Authorization', 'Bearer ' || (SELECT value FROM pg_settings WHERE name = 'supabase.service_key'))],
          'application/json',
          json_build_object(
            'messageId', v_message.id,
            'caption', v_message.caption,
            'correlationId', v_correlation_id
          )::text
        ));
      
      v_processed := v_processed + 1;
    END LOOP;
    
    -- Log the batch processing
    IF v_processed > 0 THEN
      INSERT INTO unified_audit_logs (
        event_type, 
        entity_type, 
        metadata,
        correlation_id
      ) VALUES (
        'batch_caption_processing',
        'system',
        json_build_object(
          'processed_count', v_processed,
          'source', 'cron',
          'timestamp', NOW()
        ),
        v_correlation_id
      );
    END IF;
  END
  $$;
  $$
);

-- Create a cron job to collect daily processing stats (midnight)
SELECT cron.schedule(
  'log-processing-stats',
  '0 0 * * *',  -- midnight every day
  $$
  INSERT INTO processing_stats (
    stats_date,
    total_messages,
    pending_count,
    processing_count,
    completed_count,
    error_count,
    avg_processing_time_ms
  )
  SELECT
    CURRENT_DATE,
    COUNT(*),
    COUNT(*) FILTER (WHERE processing_state = 'pending'),
    COUNT(*) FILTER (WHERE processing_state = 'processing'),
    COUNT(*) FILTER (WHERE processing_state = 'completed'),
    COUNT(*) FILTER (WHERE processing_state = 'error'),
    AVG(
      CASE
        WHEN processing_state = 'completed' AND processing_started_at IS NOT NULL AND processing_completed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (processing_completed_at - processing_started_at)) * 1000
        ELSE NULL
      END
    )
  FROM messages
  WHERE created_at > CURRENT_DATE - INTERVAL '7 days';
  
  -- Also log to unified_audit_logs for immediate visibility
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  )
  SELECT
    'processing_stats_logged',
    'system',
    jsonb_build_object(
      'date', CURRENT_DATE,
      'total_messages', COUNT(*),
      'pending_count', COUNT(*) FILTER (WHERE processing_state = 'pending'),
      'processing_count', COUNT(*) FILTER (WHERE processing_state = 'processing'),
      'completed_count', COUNT(*) FILTER (WHERE processing_state = 'completed'),
      'error_count', COUNT(*) FILTER (WHERE processing_state = 'error')
    )
  FROM messages
  WHERE created_at > CURRENT_DATE - INTERVAL '7 days';
  $$
);
