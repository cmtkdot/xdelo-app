-- Migration: 20250410_media_group_sync_cron
-- Description: Adds database function to identify inconsistent media groups for cron job

-- Create function to identify media groups with inconsistent analyzed_content
CREATE OR REPLACE FUNCTION public.find_inconsistent_media_groups(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  media_group_id TEXT,
  message_count INTEGER,
  syncable_messages INTEGER,
  needs_sync_messages INTEGER,
  best_source_id UUID
) AS $$
DECLARE
  v_media_group RECORD;
BEGIN
  -- Find media groups with at least one message that has analyzed_content
  -- and at least one message that's missing analyzed_content
  FOR v_media_group IN (
    WITH media_group_stats AS (
      SELECT 
        media_group_id,
        COUNT(*) AS total_messages,
        COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) AS with_content,
        COUNT(*) FILTER (WHERE analyzed_content IS NULL) AS without_content
      FROM 
        public.messages 
      WHERE 
        media_group_id IS NOT NULL
      GROUP BY 
        media_group_id
      HAVING 
        COUNT(*) > 1  -- Only groups with multiple messages
        AND COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) > 0  -- At least one with content
        AND COUNT(*) FILTER (WHERE analyzed_content IS NULL) > 0  -- At least one without content
      ORDER BY
        COUNT(*) DESC  -- Prioritize groups with more messages
      LIMIT p_limit
    )
    SELECT * FROM media_group_stats
  ) LOOP
    -- For each inconsistent group, find the best source message
    -- (one with analyzed_content, preferably with a caption)
    media_group_id := v_media_group.media_group_id;
    message_count := v_media_group.total_messages;
    syncable_messages := v_media_group.with_content;
    needs_sync_messages := v_media_group.without_content;
    
    -- Find the best source message (with content and caption if possible)
    SELECT id INTO best_source_id
    FROM public.messages
    WHERE 
      media_group_id = v_media_group.media_group_id
      AND analyzed_content IS NOT NULL
    ORDER BY 
      -- Prioritize messages with captions
      (caption IS NOT NULL) DESC,
      -- Then by completeness of analyzed_content (approximated by JSONB size)
      jsonb_array_length(
        CASE 
          WHEN jsonb_typeof(analyzed_content->'parsed'->'entities') = 'array'
          THEN analyzed_content->'parsed'->'entities'
          ELSE '[]'::jsonb
        END
      ) DESC,
      -- Then by most recent update
      last_modified_at DESC NULLS LAST
    LIMIT 1;
    
    -- Return this row
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add documentation comment for the function
COMMENT ON FUNCTION public.find_inconsistent_media_groups(INTEGER) IS 
'Finds media groups that have inconsistent analyzed_content across messages.
Returns information about each group and identifies the best source message
to use for synchronization.

Parameters:
- p_limit: Maximum number of media groups to return (default: 50)

Returns a table with:
- media_group_id: The Telegram media group ID
- message_count: Total number of messages in the group
- syncable_messages: Number of messages with analyzed_content
- needs_sync_messages: Number of messages missing analyzed_content
- best_source_id: UUID of the best message to use as a source for syncing';
