-- Migration up: Add message types and fix caption handling
-- Description: This migration ensures proper handling of media groups and text messages
-- Author: System
-- Date: 2024-04-11

-- Save dependent objects' definitions before dropping them
DO $$
DECLARE
  trigger_def text;
  view_def_forwards text;
  view_def_stats text;
BEGIN
  -- Try to save the view definitions
  BEGIN
    SELECT pg_get_viewdef('v_message_forwards'::regclass, true) INTO view_def_forwards;
    IF view_def_forwards IS NOT NULL THEN
      EXECUTE 'CREATE TABLE IF NOT EXISTS temp_view_definitions(view_name text, definition text)';
      EXECUTE 'INSERT INTO temp_view_definitions VALUES (''v_message_forwards'', $1)' USING view_def_forwards;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not save v_message_forwards definition: %', SQLERRM;
  END;
  
  BEGIN
    SELECT pg_get_viewdef('v_message_processing_stats'::regclass, true) INTO view_def_stats;
    IF view_def_stats IS NOT NULL THEN
      EXECUTE 'CREATE TABLE IF NOT EXISTS temp_view_definitions(view_name text, definition text)';
      EXECUTE 'INSERT INTO temp_view_definitions VALUES (''v_message_processing_stats'', $1)' USING view_def_stats;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not save v_message_processing_stats definition: %', SQLERRM;
  END;
  
  -- Try to save the trigger function definition
  BEGIN
    SELECT pg_get_functiondef(oid) 
    INTO trigger_def
    FROM pg_proc 
    WHERE proname = 'xdelo_trg_forward_media_fn';
    
    IF trigger_def IS NOT NULL THEN
      EXECUTE 'CREATE TABLE IF NOT EXISTS temp_trigger_definition(definition text)';
      EXECUTE 'INSERT INTO temp_trigger_definition VALUES ($1)' USING trigger_def;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not save trigger function definition: %', SQLERRM;
  END;
END $$;

-- Drop dependent objects with CASCADE to allow column type changes
DROP TRIGGER IF EXISTS xdelo_trg_forward_media ON messages;
DROP VIEW IF EXISTS v_message_forwards CASCADE;
DROP VIEW IF EXISTS v_message_processing_stats CASCADE;

-- Add the message_type column for better type identification
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS text text;  -- Add text column if it doesn't exist

-- Update message_type based on the presence of file_id and caption/text
UPDATE messages 
SET message_type = 
  CASE
    -- Media messages have file_id
    WHEN file_id IS NOT NULL THEN 'media'
    -- Text-only messages have text but no file_id
    WHEN text IS NOT NULL AND (file_id IS NULL) THEN 'text'
    -- Default to 'unknown' if can't determine
    ELSE 'unknown'
  END;

-- Make message_type NOT NULL after populating
ALTER TABLE messages ALTER COLUMN message_type SET NOT NULL;

-- Fix data type issues in the messages table
ALTER TABLE messages 
  ALTER COLUMN is_forward TYPE boolean USING (CASE WHEN is_forward = 'true' THEN TRUE ELSE FALSE END),
  ALTER COLUMN storage_exists TYPE boolean USING (CASE WHEN storage_exists = 'true' THEN TRUE ELSE FALSE END),
  ALTER COLUMN storage_path_standardized TYPE boolean USING (CASE WHEN storage_path_standardized = 'true' THEN TRUE ELSE FALSE END),
  ALTER COLUMN media_group_sync TYPE boolean USING (CASE WHEN media_group_sync = 'true' THEN TRUE ELSE FALSE END);

-- Try to recreate the views if they existed
DO $$
DECLARE
  view_def text;
  view_name text;
BEGIN
  -- Check if we have any saved view definitions
  FOR view_name, view_def IN 
    SELECT vd.view_name, vd.definition FROM temp_view_definitions vd
  LOOP
    BEGIN
      -- Adjust the view definition to use boolean instead of text
      view_def := REPLACE(view_def, 'is_forward = ''true''', 'is_forward = TRUE');
      view_def := REPLACE(view_def, 'is_forward = ''false''', 'is_forward = FALSE');
      
      -- Additional replacements for potential text/boolean comparisons
      view_def := REPLACE(view_def, 'is_forward::text', 'is_forward::boolean::text');
      
      -- Execute the adjusted view definition
      EXECUTE view_def;
      RAISE NOTICE 'Successfully recreated view %', view_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error recreating view %: %', view_name, SQLERRM;
    END;
  END LOOP;
  
  -- Clean up
  DROP TABLE IF EXISTS temp_view_definitions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in view recreation block: %', SQLERRM;
END $$;

-- Try to recreate the trigger if it existed
DO $$
DECLARE
  trigger_def text;
BEGIN
  -- Check if we have a saved trigger function definition
  BEGIN
    SELECT definition INTO trigger_def FROM temp_trigger_definition;
    IF trigger_def IS NOT NULL THEN
      -- Update the function definition to use boolean instead of text
      trigger_def := REPLACE(trigger_def, 'is_forward = ''true''', 'is_forward = TRUE');
      trigger_def := REPLACE(trigger_def, 'is_forward = ''false''', 'is_forward = FALSE');
      
      -- Additional replacements for potential text/boolean comparisons
      trigger_def := REPLACE(trigger_def, 'is_forward::text', 'is_forward::boolean::text');
      
      -- Execute the updated function definition
      EXECUTE trigger_def;
      
      -- Recreate the trigger
      EXECUTE 'CREATE TRIGGER xdelo_trg_forward_media
                AFTER INSERT OR UPDATE ON messages
                FOR EACH ROW
                WHEN (NEW.is_forward = TRUE)
                EXECUTE FUNCTION xdelo_trg_forward_media_fn()';
                
      DROP TABLE temp_trigger_definition;
      
      RAISE NOTICE 'Successfully recreated trigger xdelo_trg_forward_media';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error recreating trigger: %', SQLERRM;
  END;
END $$;

-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_messages_media_group_id ON messages(media_group_id);
CREATE INDEX IF NOT EXISTS idx_messages_processing_state ON messages(processing_state);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_msg_id ON messages(chat_id, telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_file_id ON messages(file_id) WHERE file_id IS NOT NULL;

-- Drop the existing media group sync function before recreating it
DROP FUNCTION IF EXISTS xdelo_sync_media_group(uuid, text, text, boolean, boolean);

-- Update the media group synchronization function to handle captions correctly
CREATE OR REPLACE FUNCTION xdelo_sync_media_group(
  p_source_message_id UUID,
  p_media_group_id TEXT,
  p_correlation_id TEXT,
  p_force_sync BOOLEAN DEFAULT FALSE,
  p_sync_edit_history BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_source_message messages;
  v_group_messages UUID[];
  v_synced_count INTEGER := 0;
  v_update_data JSONB;
  v_result JSONB;
  v_lock_key TEXT;
BEGIN
  -- Generate a lock key to prevent concurrent syncs of the same group
  v_lock_key := 'media_group_sync_' || p_media_group_id;
  
  -- Try to acquire an advisory lock to prevent concurrent syncs
  IF NOT pg_try_advisory_xact_lock(hashtext(v_lock_key)) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'error', 'Could not acquire lock for media group synchronization'
    );
  END IF;
  
  -- Get the source message
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id;
  
  IF v_source_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'error', 'Source message not found'
    );
  END IF;

  -- Check if source message has analyzed content or caption
  IF v_source_message.analyzed_content IS NULL AND NOT p_force_sync THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'error', 'Source message has no analyzed content'
    );
  END IF;

  -- Mark source message as original caption holder
  UPDATE messages
  SET 
    is_original_caption = TRUE,
    group_caption_synced = TRUE,
    updated_at = NOW()
  WHERE id = p_source_message_id;

  -- Get all other messages in the media group
  SELECT ARRAY_AGG(id) INTO v_group_messages
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND id != p_source_message_id;

  -- If no other messages in group, return success with 0 synced
  IF v_group_messages IS NULL OR ARRAY_LENGTH(v_group_messages, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'synced_count', 0,
      'media_group_id', p_media_group_id
    );
  END IF;
  
  -- Prepare the update data - sync caption (not text) across media group
  v_update_data := jsonb_build_object(
    'analyzed_content', v_source_message.analyzed_content,
    'caption', v_source_message.caption, -- Important: Sync the caption, not text
    'message_caption_id', p_source_message_id,
    'is_original_caption', FALSE,
    'group_caption_synced', TRUE,
    'processing_state', 'completed',
    'processing_completed_at', NOW(),
    'updated_at', NOW()
  );
  
  -- Add edit history if requested
  IF p_sync_edit_history AND v_source_message.edit_history IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('edit_history', v_source_message.edit_history);
  END IF;
  
  IF p_sync_edit_history AND v_source_message.old_analyzed_content IS NOT NULL THEN
    v_update_data := v_update_data || jsonb_build_object('old_analyzed_content', v_source_message.old_analyzed_content);
  END IF;
  
  -- Update all messages in the group
  WITH updated_messages AS (
    UPDATE messages
    SET 
      analyzed_content = v_update_data->>'analyzed_content',
      caption = v_update_data->>'caption', -- Sync caption
      message_caption_id = (v_update_data->>'message_caption_id')::uuid,
      is_original_caption = (v_update_data->>'is_original_caption')::boolean,
      group_caption_synced = (v_update_data->>'group_caption_synced')::boolean,
      processing_state = v_update_data->>'processing_state',
      processing_completed_at = NOW(),
      updated_at = NOW(),
      edit_history = CASE WHEN p_sync_edit_history THEN 
                       v_source_message.edit_history
                     ELSE 
                       edit_history 
                     END,
      old_analyzed_content = CASE WHEN p_sync_edit_history THEN 
                               v_source_message.old_analyzed_content
                             ELSE 
                               old_analyzed_content 
                             END
    WHERE id = ANY(v_group_messages)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_synced_count FROM updated_messages;
  
  -- Log the sync operation
  PERFORM xdelo_log_event(
    'media_group_synced',
    p_source_message_id::TEXT,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'synced_count', v_synced_count,
      'sync_edit_history', p_sync_edit_history
    )
  );
  
  -- Return success result
  RETURN jsonb_build_object(
    'success', TRUE,
    'synced_count', v_synced_count,
    'media_group_id', p_media_group_id
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log the error
  PERFORM xdelo_log_event(
    'media_group_sync_error',
    p_source_message_id::TEXT,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'error', SQLERRM
    ),
    SQLERRM
  );
  
  -- Return error result
  RETURN jsonb_build_object(
    'success', FALSE,
    'synced_count', 0,
    'media_group_id', p_media_group_id,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql;

-- Drop existing function before recreating it
DROP FUNCTION IF EXISTS xdelo_check_messages_needing_caption_sync();

-- Add function to check for messages needing caption sync
CREATE OR REPLACE FUNCTION xdelo_check_messages_needing_caption_sync()
RETURNS TABLE (
  media_group_id text,
  message_count int,
  sync_status jsonb
) AS $$
BEGIN
  RETURN QUERY
  WITH media_groups AS (
    SELECT 
      m.media_group_id,
      COUNT(*) AS message_count,
      SUM(CASE WHEN m.group_caption_synced THEN 1 ELSE 0 END) AS synced_count,
      SUM(CASE WHEN m.is_original_caption THEN 1 ELSE 0 END) AS original_caption_count
    FROM 
      messages m
    WHERE 
      m.media_group_id IS NOT NULL
    GROUP BY 
      m.media_group_id
    HAVING 
      COUNT(*) > 1 -- Only groups with multiple messages
  )
  SELECT 
    mg.media_group_id,
    mg.message_count,
    jsonb_build_object(
      'synced_count', mg.synced_count,
      'original_caption_count', mg.original_caption_count,
      'needs_sync', mg.synced_count < mg.message_count OR mg.original_caption_count != 1
    ) AS sync_status
  FROM 
    media_groups mg
  WHERE
    mg.synced_count < mg.message_count OR mg.original_caption_count != 1
  ORDER BY 
    mg.message_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the table to document the distinction
COMMENT ON TABLE messages IS 'Stores both media messages (with captions) and text messages. For media groups, captions are synchronized across all media in the group while preserving the original caption source.'; 