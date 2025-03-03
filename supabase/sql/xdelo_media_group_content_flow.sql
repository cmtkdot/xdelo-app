
-- Comprehensive Media Group Content Flow Implementation
-- This script implements a complete solution for handling media group content syncing,
-- including support for analyzed_content history, edited messages, and proper logging.

-- Clean up any existing functions that will be replaced
DROP FUNCTION IF EXISTS xdelo_check_media_group_content;
DROP FUNCTION IF EXISTS xdelo_sync_media_group_content;
DROP FUNCTION IF EXISTS xdelo_sync_media_group_analyzed_content CASCADE;
DROP TRIGGER IF EXISTS trg_sync_media_group_content ON messages;
DROP FUNCTION IF EXISTS xdelo_sync_caption_to_media_group;

-- Function to check if a media group has analyzed content and sync if found
CREATE OR REPLACE FUNCTION xdelo_check_media_group_content(
  p_media_group_id TEXT,
  p_message_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_analyzed_content JSONB;
  v_caption_message_id UUID;
  v_sync_count INTEGER;
  v_result JSONB;
BEGIN
  -- Skip if no media group ID
  IF p_media_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_media_group_id'
    );
  END IF;
  
  -- Find a message in the group with analyzed content
  SELECT 
    m.id, 
    m.analyzed_content 
  INTO 
    v_caption_message_id, 
    v_analyzed_content
  FROM 
    messages m
  WHERE 
    m.media_group_id = p_media_group_id
    AND m.analyzed_content IS NOT NULL
    AND m.processing_state = 'completed'
    AND m.id != p_message_id -- Don't use the current message
  ORDER BY 
    m.is_original_caption DESC, -- Prefer original caption messages
    m.created_at ASC -- Otherwise use the earliest message
  LIMIT 1;
  
  -- No analyzed content found in the group
  IF v_caption_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_analyzed_content_in_group'
    );
  END IF;
  
  -- Update the current message with the found content
  UPDATE messages
  SET 
    analyzed_content = v_analyzed_content,
    message_caption_id = v_caption_message_id,
    is_original_caption = false,
    group_caption_synced = true,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    updated_at = NOW()
  WHERE 
    id = p_message_id;
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type, 
    entity_id, 
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_content_synced',
    p_message_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'source_message_id', v_caption_message_id,
      'operation', 'check_and_sync'
    ),
    NOW()
  );
  
  -- Build result
  RETURN jsonb_build_object(
    'success', true,
    'analyzed_content', v_analyzed_content,
    'source_message_id', v_caption_message_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to sync analyzed content from a source message to all messages in a media group
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
$$ LANGUAGE plpgsql;

-- Function to handle updating caption in a media group
CREATE OR REPLACE FUNCTION xdelo_sync_caption_to_media_group(
  p_message_id UUID,
  p_new_caption TEXT,
  p_update_telegram BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_media_group_id TEXT;
  v_result JSONB;
  v_message RECORD;
  v_telegram_data JSONB;
  v_update_count INTEGER := 0;
BEGIN
  -- Get the message and media group ID
  SELECT 
    id, 
    media_group_id, 
    telegram_data,
    analyzed_content
  INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'message_not_found'
    );
  END IF;
  
  v_media_group_id := v_message.media_group_id;
  
  -- Skip if no media group ID
  IF v_media_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'no_media_group_id'
    );
  END IF;
  
  -- Update the caption in the telegram_data JSON
  v_telegram_data := v_message.telegram_data;
  IF v_telegram_data ? 'message' AND v_telegram_data->'message' ? 'caption' THEN
    v_telegram_data := jsonb_set(
      v_telegram_data, 
      '{message,caption}', 
      to_jsonb(p_new_caption)
    );
  END IF;
  
  -- Update the source message with new caption
  UPDATE messages
  SET 
    caption = p_new_caption,
    telegram_data = v_telegram_data,
    updated_at = NOW(),
    is_edited = true,
    edit_count = COALESCE(edit_count, 0) + 1,
    processing_state = 'pending',  -- Mark for reprocessing
    analyzed_content = NULL        -- Clear analyzed content for reanalysis
  WHERE 
    id = p_message_id;
  
  -- If requested, update processed state in other group messages to indicate reprocessing needed
  IF p_update_telegram THEN
    UPDATE messages
    SET 
      group_caption_synced = false,
      processing_state = 'pending',
      updated_at = NOW()
    WHERE 
      media_group_id = v_media_group_id
      AND id != p_message_id;
    
    -- Count updated messages
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
  END IF;
  
  -- Log the caption update
  INSERT INTO unified_audit_logs (
    event_type, 
    entity_id, 
    metadata,
    event_timestamp
  ) VALUES (
    'caption_updated',
    p_message_id,
    jsonb_build_object(
      'media_group_id', v_media_group_id,
      'new_caption', p_new_caption,
      'group_updates', v_update_count,
      'update_telegram', p_update_telegram
    ),
    NOW()
  );
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'media_group_id', v_media_group_id,
    'updated_count', v_update_count
  );
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to sync media group content when a message is completed
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_analyzed_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if this is an update that changes analyzed_content
  -- and the message is part of a media group
  IF (TG_OP = 'UPDATE' AND 
      NEW.analyzed_content IS NOT NULL AND 
      (OLD.analyzed_content IS NULL OR OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content) AND
      NEW.media_group_id IS NOT NULL) THEN
    
    -- If is_original_caption is not set and has caption, mark as original caption
    IF NEW.is_original_caption IS NULL AND NEW.caption IS NOT NULL THEN
      NEW.is_original_caption := true;
    END IF;
    
    -- Trigger the sync operation asynchronously by logging in a tracking table
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      metadata,
      event_timestamp
    ) VALUES (
      'media_group_sync_requested',
      NEW.id,
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'analyzed_content_updated', true,
        'source_message_id', NEW.id
      ),
      NOW()
    );
    
    -- Queue function execution via trigger notification
    PERFORM pg_notify(
      'media_group_sync', 
      json_build_object(
        'media_group_id', NEW.media_group_id,
        'source_message_id', NEW.id
      )::text
    );
    
    -- Immediately sync the content (could be replaced with asynchronous processing)
    PERFORM xdelo_sync_media_group_content(NEW.media_group_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trg_sync_media_group_content
  AFTER UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_sync_media_group_analyzed_content();

-- Function to find a valid file_id for a specific file_unique_id in a media group
CREATE OR REPLACE FUNCTION xdelo_find_valid_file_id(
  p_media_group_id TEXT,
  p_file_unique_id TEXT
) RETURNS TEXT AS $$
DECLARE
  v_file_id TEXT;
BEGIN
  -- Find the most recent valid file_id in the media group
  SELECT 
    file_id 
  INTO 
    v_file_id
  FROM 
    messages
  WHERE 
    media_group_id = p_media_group_id
    AND file_unique_id = p_file_unique_id
    AND file_id IS NOT NULL
    AND (
      file_id_expires_at IS NULL 
      OR file_id_expires_at > NOW()
    )
  ORDER BY 
    created_at DESC
  LIMIT 1;
  
  RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;

-- Function to standardize storage path format
CREATE OR REPLACE FUNCTION xdelo_standardize_storage_path(
  p_file_unique_id TEXT,
  p_mime_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_extension TEXT;
BEGIN
  -- Extract extension from mime type
  IF p_mime_type IS NULL THEN
    v_extension := 'jpeg'; -- Default to jpeg if mime type is missing
  ELSE
    v_extension := split_part(p_mime_type, '/', 2);
    
    -- Handle special cases and defaults
    IF v_extension IS NULL OR v_extension = '' THEN
      IF p_mime_type LIKE 'video/%' THEN
        v_extension := 'mp4';
      ELSIF p_mime_type LIKE 'image/%' THEN
        v_extension := 'jpeg';
      ELSE
        v_extension := 'bin';
      END IF;
    END IF;
  END IF;
  
  -- Build standardized path
  RETURN p_file_unique_id || '.' || v_extension;
END;
$$ LANGUAGE plpgsql;

-- Update existing messages to use standardized storage paths
DO $$
DECLARE
  v_message RECORD;
  v_standardized_path TEXT;
BEGIN
  FOR v_message IN 
    SELECT 
      id, 
      file_unique_id, 
      mime_type, 
      storage_path 
    FROM 
      messages 
    WHERE 
      file_unique_id IS NOT NULL 
      AND storage_path IS NOT NULL
  LOOP
    v_standardized_path := xdelo_standardize_storage_path(
      v_message.file_unique_id, 
      v_message.mime_type
    );
    
    -- Only update if different
    IF v_message.storage_path != v_standardized_path THEN
      UPDATE messages
      SET 
        storage_path = v_standardized_path,
        updated_at = NOW()
      WHERE 
        id = v_message.id;
    END IF;
  END LOOP;
END;
$$;
