
-- Create a function to find media groups with inconsistent states
CREATE OR REPLACE FUNCTION public.xdelo_find_broken_media_groups()
 RETURNS TABLE(media_group_id text, source_message_id uuid, total_count bigint, pending_count bigint, analyzed_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH media_group_stats AS (
    SELECT 
      mg.media_group_id,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE m.processing_state = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE m.analyzed_content IS NOT NULL) as analyzed_count,
      -- Find a suitable source message
      (SELECT id FROM messages 
       WHERE media_group_id = mg.media_group_id 
         AND is_original_caption = true 
         AND analyzed_content IS NOT NULL
       LIMIT 1) as caption_message_id
    FROM messages m
    JOIN (
      SELECT DISTINCT media_group_id 
      FROM messages 
      WHERE media_group_id IS NOT NULL
      AND deleted_from_telegram = false
    ) mg ON m.media_group_id = mg.media_group_id
    WHERE 
      m.deleted_from_telegram = false
      AND m.media_group_id IS NOT NULL
    GROUP BY mg.media_group_id
  )
  SELECT 
    media_group_id,
    COALESCE(caption_message_id, 
      (SELECT id FROM messages 
       WHERE media_group_id = mgs.media_group_id 
         AND caption IS NOT NULL 
         AND analyzed_content IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 1)
    ) as source_message_id,
    total_count,
    pending_count,
    analyzed_count
  FROM media_group_stats mgs
  WHERE 
    (pending_count > 0 AND analyzed_count > 0) -- Mixed states
    OR (analyzed_count = 0 AND pending_count > 0) -- All pending
  ORDER BY 
    pending_count DESC, 
    total_count DESC
  LIMIT 50;
END;
$function$;
