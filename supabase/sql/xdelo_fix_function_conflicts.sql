
-- Fix function name conflicts
DO $$
BEGIN
  -- Drop all versions of xdelo_sync_media_group_content to avoid conflicts
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(uuid, text);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(text, uuid);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(text, uuid, text);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(uuid, text, text);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(uuid);
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_content(text);

  -- Drop related triggers and functions
  DROP TRIGGER IF EXISTS xdelo_trg_sync_media_group_content ON messages;
  DROP FUNCTION IF EXISTS xdelo_sync_media_group_analyzed_content();
  
  -- Create the correctly defined function
  CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
    p_media_group_id TEXT,
    p_source_message_id UUID
  ) RETURNS INTEGER AS $$
  DECLARE
    v_analyzed_content JSONB;
    v_old_analyzed_content JSONB[];
    v_source_caption TEXT;
    v_sync_count INTEGER := 0;
    v_message RECORD;
  BEGIN
    -- Skip if no media group ID
    IF p_media_group_id IS NULL THEN
      RETURN 0;
    END IF;

    -- Get the analyzed content and caption from the source message
    SELECT 
      analyzed_content,
      old_analyzed_content,
      caption
    INTO 
      v_analyzed_content,
      v_old_analyzed_content,
      v_source_caption
    FROM 
      messages
    WHERE 
      id = p_source_message_id;
      
    -- If no analyzed content in source, exit
    IF v_analyzed_content IS NULL THEN
      RETURN 0;
    END IF;

    -- Mark source message as the original caption holder
    UPDATE messages
    SET 
      is_original_caption = true,
      group_caption_synced = true,
      updated_at = NOW()
    WHERE 
      id = p_source_message_id;

    -- Sync to all other messages in the group
    FOR v_message IN 
      SELECT id, analyzed_content, old_analyzed_content
      FROM messages
      WHERE 
        media_group_id = p_media_group_id
        AND id != p_source_message_id
    LOOP
      -- Preserve history if message has existing analyzed content
      IF v_message.analyzed_content IS NOT NULL THEN
        UPDATE messages
        SET 
          old_analyzed_content = CASE 
            -- If already has old_analyzed_content array, append current analyzed_content
            WHEN v_message.old_analyzed_content IS NOT NULL 
            THEN v_message.old_analyzed_content || v_message.analyzed_content::jsonb
            -- Otherwise create new array with just current analyzed_content
            ELSE ARRAY[v_message.analyzed_content::jsonb]
          END,
          analyzed_content = v_analyzed_content,
          message_caption_id = p_source_message_id,
          is_original_caption = false,
          group_caption_synced = true,
          processing_state = 'completed',
          processing_completed_at = COALESCE(processing_completed_at, NOW()),
          updated_at = NOW()
        WHERE 
          id = v_message.id;
      ELSE
        -- Simple update if no previous analyzed content
        UPDATE messages
        SET 
          analyzed_content = v_analyzed_content,
          message_caption_id = p_source_message_id,
          is_original_caption = false,
          group_caption_synced = true,
          processing_state = 'completed',
          processing_completed_at = COALESCE(processing_completed_at, NOW()),
          updated_at = NOW()
        WHERE 
          id = v_message.id;
      END IF;
      
      v_sync_count := v_sync_count + 1;
    END LOOP;

    -- Update media group metadata for all messages in the group
    WITH group_stats AS (
      SELECT 
        COUNT(*) as message_count,
        MIN(created_at) as first_message_time,
        MAX(created_at) as last_message_time
      FROM messages
      WHERE media_group_id = p_media_group_id
    )
    UPDATE messages m
    SET
      group_message_count = gs.message_count,
      group_first_message_time = gs.first_message_time,
      group_last_message_time = gs.last_message_time,
      updated_at = NOW()
    FROM group_stats gs
    WHERE m.media_group_id = p_media_group_id;

    -- Log the sync operation
    INSERT INTO unified_audit_logs (
      event_type, 
      entity_id, 
      metadata,
      event_timestamp
    ) VALUES (
      'media_group_content_synced',
      p_source_message_id,
      jsonb_build_object(
        'media_group_id', p_media_group_id,
        'sync_count', v_sync_count,
        'operation', 'sync_group',
        'source_caption', v_source_caption
      ),
      NOW()
    );

    RETURN v_sync_count;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

END $$;
