
-- This migration makes sure that the processing stats function is available and properly secured

-- Update the message processing stats function to ensure it has the SECURITY DEFINER setting
CREATE OR REPLACE FUNCTION public.xdelo_get_message_processing_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_state_counts jsonb;
  v_media_group_stats jsonb;
  v_timing_stats jsonb;
BEGIN
  -- Get counts of messages in each processing state
  SELECT 
    jsonb_build_object(
      'initialized', COUNT(*) FILTER (WHERE processing_state = 'initialized'),
      'pending', COUNT(*) FILTER (WHERE processing_state = 'pending'),
      'processing', COUNT(*) FILTER (WHERE processing_state = 'processing'),
      'completed', COUNT(*) FILTER (WHERE processing_state = 'completed'),
      'error', COUNT(*) FILTER (WHERE processing_state = 'error'),
      'total_messages', COUNT(*)
    ) INTO v_state_counts
  FROM messages;
  
  -- Get counts of messages with specific conditions
  SELECT 
    jsonb_build_object(
      'unprocessed_with_caption', COUNT(*) FILTER (WHERE caption IS NOT NULL AND caption != '' AND analyzed_content IS NULL),
      'stuck_in_processing', COUNT(*) FILTER (WHERE processing_state = 'processing' AND processing_started_at < NOW() - INTERVAL '30 minutes'),
      'stalled_no_media_group', COUNT(*) FILTER (WHERE processing_state = 'pending' AND media_group_id IS NULL AND caption IS NOT NULL AND analyzed_content IS NULL),
      'orphaned_media_group_messages', (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.media_group_id IN (
          SELECT mg.media_group_id
          FROM (
            SELECT 
              media_group_id,
              COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) AS processed_count,
              COUNT(*) FILTER (WHERE analyzed_content IS NULL) AS unprocessed_count
            FROM messages
            WHERE media_group_id IS NOT NULL
            GROUP BY media_group_id
          ) mg
          WHERE mg.processed_count > 0 AND mg.unprocessed_count > 0
        )
        AND m.analyzed_content IS NULL
      )
    ) INTO v_media_group_stats;
  
  -- Get timing statistics
  SELECT 
    jsonb_build_object(
      'avg_processing_time_seconds', (
        SELECT EXTRACT(EPOCH FROM AVG(processing_completed_at - processing_started_at))
        FROM messages
        WHERE processing_state = 'completed'
        AND processing_started_at IS NOT NULL
        AND processing_completed_at IS NOT NULL
      ),
      'oldest_unprocessed_caption_age_hours', (
        SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/3600
        FROM messages
        WHERE caption IS NOT NULL
        AND caption != ''
        AND analyzed_content IS NULL
      ),
      'oldest_stuck_processing_hours', (
        SELECT EXTRACT(EPOCH FROM (NOW() - MIN(processing_started_at)))/3600
        FROM messages
        WHERE processing_state = 'processing'
        AND processing_started_at IS NOT NULL
        AND analyzed_content IS NULL
      )
    ) INTO v_timing_stats;
  
  -- Combine all results
  v_result := jsonb_build_object(
    'state_counts', v_state_counts,
    'media_group_stats', v_media_group_stats,
    'timing_stats', v_timing_stats,
    'timestamp', NOW()
  );
  
  RETURN v_result;
END;
$$;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.xdelo_get_message_processing_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xdelo_get_message_processing_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.xdelo_get_message_processing_stats() TO service_role;
