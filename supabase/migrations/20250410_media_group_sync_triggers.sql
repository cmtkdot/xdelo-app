-- Migration: 20250410_media_group_sync_triggers.sql
-- Description: Adds triggers to automatically sync media group captions and content
-- when messages are updated or inserted.

-- =====================================
-- Step 1: Add helper function to determine if sync should happen
-- =====================================

CREATE OR REPLACE FUNCTION public.should_sync_media_group(
  p_old_record jsonb,
  p_new_record jsonb
) RETURNS boolean AS $$
DECLARE
  sync_needed boolean := false;
BEGIN
  -- Always return false if there's no media group to sync
  IF (p_new_record->>'media_group_id') IS NULL THEN
    RETURN false;
  END IF;
  
  -- For new records (p_old_record is null), check if we have enough data to sync
  IF p_old_record IS NULL THEN
    RETURN (p_new_record->>'analyzed_content') IS NOT NULL AND 
           (p_new_record->>'caption') IS NOT NULL;
  END IF;
  
  -- For updates, check if relevant fields changed
  IF (p_old_record->>'caption') IS DISTINCT FROM (p_new_record->>'caption') OR
     (p_old_record->>'analyzed_content') IS DISTINCT FROM (p_new_record->>'analyzed_content') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;


-- =====================================
-- Step 2: Create main trigger function with safeguards
-- =====================================

CREATE OR REPLACE FUNCTION public.trigger_sync_media_group_captions()
RETURNS TRIGGER AS $$
DECLARE
  _sync_state text;
  _sync_error text;
  _sync_result uuid[];
  _old_record jsonb := NULL;
  _new_record jsonb;
  v_sync_in_progress boolean := false;
BEGIN
  -- Convert records to jsonb for easier handling
  _new_record := row_to_json(NEW)::jsonb;
  
  IF TG_OP = 'UPDATE' THEN
    _old_record := row_to_json(OLD)::jsonb;
  END IF;
  
  -- Check if we should sync (based on media_group_id existence and relevant changes)
  IF NOT public.should_sync_media_group(_old_record, _new_record) THEN
    RETURN NEW;
  END IF;
  
  -- Check if we're in a recursion using a temporary table approach
  -- This is an alternative to using custom settings which might have permission issues
  BEGIN
    -- Try to create a temporary table if it doesn't exist yet
    CREATE TEMP TABLE IF NOT EXISTS _sync_media_group_lock (
      media_group_id text PRIMARY KEY,
      in_progress boolean NOT NULL
    ) ON COMMIT DROP;
    
    -- Try to insert a new lock record - if it already exists, we'll get a unique violation
    -- which we'll catch and interpret as "sync in progress"
    INSERT INTO _sync_media_group_lock (media_group_id, in_progress)
    VALUES (NEW.media_group_id, true);
  EXCEPTION WHEN unique_violation THEN
    -- We're already processing this media group, skip to avoid recursion
    v_sync_in_progress := true;
  END;
  
  -- If already in progress, return without further processing
  IF v_sync_in_progress THEN
    RETURN NEW;
  END;
  
  BEGIN
    -- Determine processing state to use
    _sync_state := COALESCE(NEW.processing_state::text, 'pending_analysis');
    
    -- Call the sync function with proper parameters
    _sync_result := public.sync_media_group_captions(
      NEW.media_group_id,
      NEW.id::text,
      NEW.caption,
      NEW.analyzed_content,
      _sync_state::public.processing_state_type
    );
    
    -- Log successful sync to audit trail
    INSERT INTO public.audit_logs (
      action_type,
      table_name,
      record_id,
      action_data,
      user_id
    ) VALUES (
      'media_group_synced',
      'messages',
      NEW.id,
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'synced_count', COALESCE(array_length(_sync_result, 1), 0),
        'caption_updated', NEW.caption IS NOT NULL,
        'trigger_source', TG_OP,
        'processing_state', _sync_state
      ),
      coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    _sync_error := SQLERRM;
    
    INSERT INTO public.audit_logs (
      action_type,
      table_name,
      record_id,
      action_data,
      user_id
    ) VALUES (
      'media_group_sync_error',
      'messages',
      NEW.id,
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'error', _sync_error,
        'trigger_source', TG_OP
      ),
      coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    );
  END;
  
  -- Clean up our lock
  DELETE FROM _sync_media_group_lock WHERE media_group_id = NEW.media_group_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================
-- Step 3: Add check to prevent unnecessary updates
-- =====================================

CREATE OR REPLACE FUNCTION public.prevent_unnecessary_message_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if nothing relevant has changed to prevent unnecessary update cycles
  IF OLD.caption IS NOT DISTINCT FROM NEW.caption AND
     OLD.analyzed_content IS NOT DISTINCT FROM NEW.analyzed_content AND
     OLD.processing_state IS NOT DISTINCT FROM NEW.processing_state AND
     OLD.is_edited IS NOT DISTINCT FROM NEW.is_edited THEN
       
    -- No relevant changes detected, skip update to prevent trigger firing
    RETURN NULL;
  END IF;
  
  -- If there are real changes, proceed with the update
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================
-- Step 4: Create triggers with proper order
-- =====================================

-- First trigger: Check if the update is necessary
DROP TRIGGER IF EXISTS before_message_update_prevent_loops ON public.messages;
CREATE TRIGGER before_message_update_prevent_loops
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unnecessary_message_updates();

-- Main trigger to sync after content changes
DROP TRIGGER IF EXISTS after_message_update_sync_media_group ON public.messages;
CREATE TRIGGER after_message_update_sync_media_group
AFTER INSERT OR UPDATE OF analyzed_content, caption
ON public.messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL)
EXECUTE FUNCTION public.trigger_sync_media_group_captions();


-- =====================================
-- Step 5: Enhance sync_media_group_captions with additional safeguards
-- =====================================

CREATE OR REPLACE FUNCTION public.sync_media_group_captions(
  p_media_group_id TEXT,
  p_exclude_message_id TEXT,
  p_caption TEXT,
  p_caption_data JSONB,
  p_processing_state public.processing_state_type DEFAULT 'pending_analysis'::public.processing_state_type
) RETURNS SETOF UUID AS $$
DECLARE
  message_id UUID;
  updated_ids UUID[] := '{}';
  v_is_edited BOOLEAN;
  v_current_timestamp TIMESTAMPTZ := now();
  v_message_record RECORD;
BEGIN
  -- Skip if any inputs are null
  IF p_media_group_id IS NULL OR p_exclude_message_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Find all other messages in the same media group
  FOR v_message_record IN 
    SELECT id, is_edited, analyzed_content, old_analyzed_content, caption
    FROM public.messages
    WHERE media_group_id = p_media_group_id
    AND id::text != p_exclude_message_id
  LOOP
    message_id := v_message_record.id;
    v_is_edited := true; -- Mark as edited since we're updating via sync
    
    -- Archive existing analyzed content if it exists and is different
    IF v_message_record.analyzed_content IS NOT NULL AND 
       v_message_record.analyzed_content IS DISTINCT FROM p_caption_data THEN
      
      -- Update the message with new caption and archived analyzed content
      UPDATE public.messages
      SET 
        caption = p_caption,
        analyzed_content = p_caption_data,
        old_analyzed_content = CASE
          WHEN v_message_record.old_analyzed_content IS NULL THEN 
            jsonb_build_array(v_message_record.analyzed_content)
          ELSE
            v_message_record.old_analyzed_content || v_message_record.analyzed_content
          END,
        processing_state = p_processing_state,
        is_edited = v_is_edited,
        last_modified_at = v_current_timestamp,
        last_synced_at = v_current_timestamp
      WHERE id = message_id;
    ELSE
      -- Just update caption and analyzed content without archiving
      UPDATE public.messages
      SET 
        caption = p_caption,
        analyzed_content = p_caption_data,
        processing_state = p_processing_state,
        is_edited = v_is_edited,
        last_modified_at = v_current_timestamp,
        last_synced_at = v_current_timestamp
      WHERE id = message_id;
    END IF;
    
    -- Add to the list of updated IDs
    updated_ids := updated_ids || message_id;
    
    -- Return each updated ID
    RETURN NEXT message_id;
  END LOOP;
  
  -- If no messages were updated, log it in the return
  IF array_length(updated_ids, 1) IS NULL THEN
    -- No messages updated
    RETURN;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================
-- Step 6: Add a last_synced_at column to the messages table
-- =====================================

-- Only add if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN last_synced_at TIMESTAMPTZ DEFAULT NULL;

    COMMENT ON COLUMN public.messages.last_synced_at IS 'Timestamp of the last media group sync operation';
  END IF;
END
$$;


-- =====================================
-- Step 7: Update Row Level Security policies to allow trigger function
-- =====================================

-- Ensure the sync function can work with RLS enabled
ALTER FUNCTION public.sync_media_group_captions(TEXT, TEXT, TEXT, JSONB, public.processing_state_type) SECURITY DEFINER;
ALTER FUNCTION public.trigger_sync_media_group_captions() SECURITY DEFINER;
ALTER FUNCTION public.prevent_unnecessary_message_updates() SECURITY DEFINER;
ALTER FUNCTION public.should_sync_media_group(jsonb, jsonb) SECURITY DEFINER;

-- No need for any special grants with the temporary table approach
