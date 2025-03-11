
-- Start transaction
BEGIN;

-- Create function to repair orphaned media group messages
CREATE OR REPLACE FUNCTION public.xdelo_repair_orphaned_media_group_messages(
  p_limit integer DEFAULT 50
)
RETURNS TABLE(message_id uuid, media_group_id text, synced boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_media_group record;
  v_message record;
  v_sync_result jsonb;
  v_correlation_id text := gen_random_uuid()::text;
BEGIN
  -- Find media groups with at least one analyzed message and at least one pending/error message
  FOR v_media_group IN 
    SELECT DISTINCT mg.media_group_id
    FROM (
      SELECT 
        media_group_id,
        COUNT(*) FILTER (WHERE analyzed_content IS NOT NULL) AS analyzed_count,
        COUNT(*) FILTER (WHERE processing_state IN ('pending', 'error', 'processing') AND analyzed_content IS NULL) AS unprocessed_count
      FROM messages
      WHERE 
        media_group_id IS NOT NULL 
        AND deleted_from_telegram = false
      GROUP BY media_group_id
    ) mg
    WHERE 
      mg.analyzed_count > 0 
      AND mg.unprocessed_count > 0
    LIMIT p_limit
  LOOP
    -- For each media group, find the best message with analyzed content to be the source
    SELECT id INTO v_message.source_id
    FROM messages
    WHERE 
      media_group_id = v_media_group.media_group_id
      AND analyzed_content IS NOT NULL
      AND deleted_from_telegram = false
    ORDER BY 
      is_original_caption DESC,
      created_at ASC
    LIMIT 1;
    
    -- For each media group, find unprocessed messages
    FOR v_message IN
      SELECT id
      FROM messages
      WHERE 
        media_group_id = v_media_group.media_group_id
        AND analyzed_content IS NULL
        AND processing_state IN ('pending', 'error', 'processing')
        AND deleted_from_telegram = false
      LIMIT 20
    LOOP
      -- Try to sync this message from the source
      v_sync_result := xdelo_check_media_group_content(
        v_media_group.media_group_id, 
        v_message.id,
        v_correlation_id
      );
      
      message_id := v_message.id;
      media_group_id := v_media_group.media_group_id;
      synced := (v_sync_result->>'success')::boolean;
      
      RETURN NEXT;
    END LOOP;
  END LOOP;
  
  -- Log the repair attempt
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'orphaned_media_groups_repaired',
    v_correlation_id,
    jsonb_build_object(
      'repair_attempted', FOUND,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN;
END;
$$;

-- Create comprehensive repair function that fixes multiple issues
CREATE OR REPLACE FUNCTION public.xdelo_repair_all_processing_systems(
  p_repair_stalled boolean DEFAULT true,
  p_repair_media_groups boolean DEFAULT true,
  p_repair_relationships boolean DEFAULT true,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correlation_id text := gen_random_uuid()::text;
  v_stalled_count integer := 0;
  v_media_group_count integer := 0;
  v_relationship_count integer := 0;
  v_result record;
BEGIN
  -- Reset stalled messages
  IF p_repair_stalled THEN
    FOR v_result IN SELECT * FROM xdelo_reset_stalled_messages(INTERVAL '30 minutes', p_limit) LOOP
      v_stalled_count := v_stalled_count + 1;
    END LOOP;
  END IF;
  
  -- Repair media groups
  IF p_repair_media_groups THEN
    FOR v_result IN SELECT * FROM xdelo_repair_orphaned_media_group_messages(p_limit) LOOP
      IF v_result.synced THEN
        v_media_group_count := v_media_group_count + 1;
      END IF;
    END LOOP;
  END IF;
  
  -- Repair message relationships
  IF p_repair_relationships THEN
    DECLARE
      v_relationship_result jsonb;
    BEGIN
      v_relationship_result := xdelo_repair_message_relationships();
      v_relationship_count := (v_relationship_result->>'fixed_references')::integer + 
                              (v_relationship_result->>'fixed_captions')::integer;
    END;
  END IF;
  
  -- Log the repair operation
  INSERT INTO unified_audit_logs (
    event_type,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'processing_system_repaired',
    v_correlation_id,
    jsonb_build_object(
      'stalled_reset', v_stalled_count,
      'media_groups_fixed', v_media_group_count,
      'relationships_fixed', v_relationship_count,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'correlation_id', v_correlation_id,
    'stalled_reset', v_stalled_count,
    'media_groups_fixed', v_media_group_count,
    'relationships_fixed', v_relationship_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'correlation_id', v_correlation_id
    );
END;
$$;

-- Commit transaction
COMMIT;
