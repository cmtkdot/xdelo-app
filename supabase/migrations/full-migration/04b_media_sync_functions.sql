-- XdeloMedia Media Synchronization Functions Migration
-- This script creates all functions related to media group synchronization

-- Function to log events (required by media sync functions)
CREATE OR REPLACE FUNCTION public.xdelo_log_event(
    p_event_type audit_event_type, 
    p_entity_id uuid, 
    p_correlation_id text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL, 
    p_error_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        metadata,
        correlation_id,
        error_message
    ) VALUES (
        p_event_type,
        p_entity_id,
        p_metadata,
        p_correlation_id,
        p_error_message
    );
END;
$$;

-- Function to check if media group should be synced
CREATE OR REPLACE FUNCTION public.should_sync_media_group(
    p_old_record jsonb, 
    p_new_record jsonb
) RETURNS boolean
LANGUAGE plpgsql
AS $$
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
$$;

-- Function to sync media group captions
CREATE OR REPLACE FUNCTION public.sync_media_group_captions(
    p_exclude_message_id text,
    p_media_group_id text, 
    p_caption text, 
    p_caption_data jsonb, 
    p_processing_state processing_state_type DEFAULT 'pending_analysis'::processing_state_type
) RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_id UUID;
  v_archive_data JSONB;
BEGIN
  -- For each updated message, archive its current analyzed_content
  FOR v_updated_id IN 
    SELECT id 
    FROM public.messages 
    WHERE media_group_id = p_media_group_id
      AND id != p_exclude_message_id
      AND caption IS DISTINCT FROM p_caption
  LOOP
    -- Get current analyzed content for archiving
    SELECT 
      CASE 
        WHEN analyzed_content IS NOT NULL THEN
          jsonb_build_object(
            'content', analyzed_content,
            'timestamp', EXTRACT(EPOCH FROM NOW())::bigint,
            'version', COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(old_analyzed_content)) + 1, 1)
          )
        ELSE NULL
      END
    INTO v_archive_data
    FROM public.messages 
    WHERE id = v_updated_id;
    
    -- Only archive if there's something to archive
    IF v_archive_data IS NOT NULL THEN
      -- Update the message, archiving current analyzed_content
      UPDATE public.messages
      SET 
        caption = p_caption,
        caption_data = p_caption_data,
        analyzed_content = p_caption_data,
        old_analyzed_content = CASE 
          WHEN old_analyzed_content IS NULL THEN jsonb_build_array(v_archive_data)
          ELSE old_analyzed_content || v_archive_data
        END,
        processing_state = p_processing_state,
        is_edited = TRUE,
        edit_count = COALESCE(edit_count, 0) + 1,
        last_edited_at = NOW()
      WHERE id = v_updated_id;
    ELSE
      -- Simple update without archiving
      UPDATE public.messages
      SET 
        caption = p_caption,
        caption_data = p_caption_data,
        analyzed_content = p_caption_data,
        processing_state = p_processing_state,
        is_edited = FALSE
      WHERE id = v_updated_id;
    END IF;
    
    -- Return the ID of the updated message
    RETURN NEXT v_updated_id;
  END LOOP;
  
  RETURN;
END;
$$;

-- Function to prevent trigger loops in media group synchronization
CREATE OR REPLACE FUNCTION public.trigger_sync_media_group_captions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _sync_state text;
  _sync_error text;
  _sync_result uuid[];
  _old_record jsonb := NULL;
  _new_record jsonb;
  v_sync_in_progress boolean := false;
BEGIN
  -- Don't sync if we're running in a recursive context (to prevent infinite loops)
  -- This uses the transaction-level variable to detect recursive calls
  IF current_setting('app.media_group_sync_in_progress', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Get the old and new records as JSONB for easier comparison
  IF TG_OP = 'UPDATE' THEN
    _old_record := row_to_json(OLD)::jsonb;
  END IF;
  _new_record := row_to_json(NEW)::jsonb;

  -- Skip if there's no media group or if sync is not needed (no relevant changes)
  IF NEW.media_group_id IS NULL OR NOT public.should_sync_media_group(_old_record, _new_record) THEN
    RETURN NEW;
  END IF;
  
  -- Set sync state based on current processing state to maintain semantics
  _sync_state := NEW.processing_state;
  
  -- Set the transaction-level variable to prevent recursive triggers
  PERFORM set_config('app.media_group_sync_in_progress', 'true', true);
  
  BEGIN
    -- Call the sync function
    _sync_result := public.sync_media_group_captions(
      NEW.id,
      NEW.media_group_id,
      NEW.caption,
      NEW.analyzed_content,
      _sync_state::public.processing_state_type
    );
    
    -- Log successful sync to audit trail
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      entity_type,
      operation_type,
      metadata
    ) VALUES (
      'media_group_synced',
      NEW.id,
      'messages',
      'group_sync',
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'caption', NEW.caption,
        'affected_messages', _sync_result,
        'processing_state', _sync_state
      )
    );
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    _sync_error := SQLERRM;
    
    INSERT INTO public.unified_audit_logs (
      event_type,
      entity_id,
      entity_type,
      operation_type,
      metadata,
      error_message
    ) VALUES (
      'media_group_sync_error',
      NEW.id,
      'messages',
      'group_sync',
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'caption', NEW.caption,
        'error', _sync_error
      ),
      _sync_error
    );
  END;
  
  -- Always reset the transaction variable
  PERFORM set_config('app.media_group_sync_in_progress', 'false', true);
  
  -- Always return the NEW record to continue the transaction
  RETURN NEW;
END;
$$;

-- Function for comprehensive media group synchronization
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group(
    p_source_message_id uuid, 
    p_media_group_id text, 
    p_correlation_id text,
    p_force_sync boolean DEFAULT false, 
    p_sync_edit_history boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
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
  AND id <> p_source_message_id;

  -- If no other messages in the group, return early
  IF v_group_messages IS NULL OR array_length(v_group_messages, 1) = 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'synced_count', 0,
      'media_group_id', p_media_group_id,
      'message', 'No other messages in the group to sync'
    );
  END IF;

  -- Prepare the update data to sync to other messages
  v_update_data := jsonb_build_object(
    'caption', v_source_message.caption,
    'analyzed_content', v_source_message.analyzed_content,
    'message_caption_id', p_source_message_id,
    'is_original_caption', FALSE,
    'group_caption_synced', TRUE,
    'processing_state', v_source_message.processing_state
  );

  -- Update all other messages in the group with data from source message
  WITH updated_messages AS (
    UPDATE messages
    SET 
      caption = v_source_message.caption,
      analyzed_content = v_source_message.analyzed_content,
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
    p_source_message_id,
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
    p_source_message_id,
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
$$;

-- Function to caption field synchronization
CREATE OR REPLACE FUNCTION public.sync_caption_fields_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- When caption_data is updated but analyzed_content is not
    IF (NEW.caption_data IS DISTINCT FROM OLD.caption_data AND NEW.analyzed_content IS NOT DISTINCT FROM OLD.analyzed_content) THEN
        NEW.analyzed_content := NEW.caption_data::jsonb;
    END IF;
    
    -- When analyzed_content is updated but caption_data is not
    IF (NEW.analyzed_content IS DISTINCT FROM OLD.analyzed_content AND NEW.caption_data IS NOT DISTINCT FROM OLD.caption_data) THEN
        NEW.caption_data := NEW.analyzed_content::text;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Function to process caption workflow
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
    p_message_id uuid, 
    p_correlation_id text DEFAULT NULL, 
    p_force boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_result jsonb;
  v_caption text;
  v_analyzed_content jsonb;
BEGIN
  -- Get the message details
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  -- Exit if message not found
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Message not found',
      'message_id', p_message_id
    );
  END IF;
  
  -- Skip if message already processed and force is false
  IF v_message.processing_state = 'completed' AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Message already processed',
      'skipped', true,
      'message_id', p_message_id
    );
  END IF;
  
  -- Update to processing state
  UPDATE messages
  SET 
    processing_state = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log processing started
  PERFORM public.xdelo_log_event(
    'caption_processing_started',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'telegram_message_id', v_message.telegram_message_id,
      'chat_id', v_message.chat_id,
      'media_group_id', v_message.media_group_id,
      'message_type', v_message.message_type
    )
  );
  
  -- Get the caption text to analyze
  v_caption := COALESCE(v_message.caption, v_message.text, '');
  
  -- If empty caption, just mark as completed with empty analysis
  IF v_caption = '' THEN
    UPDATE messages
    SET 
      processing_state = 'completed',
      processing_completed_at = NOW(),
      analyzed_content = '{"parsing_metadata":{"success":true,"empty_caption":true}}'::jsonb,
      updated_at = NOW()
    WHERE id = p_message_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Empty caption processed',
      'message_id', p_message_id
    );
  END IF;
  
  -- This is a simplified mock of caption analysis - in a real system, this would include more complex parsing logic
  v_analyzed_content := jsonb_build_object(
    'parsing_metadata', jsonb_build_object(
      'success', true,
      'parsing_time', extract(epoch from now())::text,
      'trigger_source', 'database_function'
    ),
    'raw_text', v_caption,
    'parsed_at', now()
  );
  
  -- Update the message with analyzed content
  UPDATE messages
  SET 
    processing_state = 'completed',
    processing_completed_at = NOW(),
    analyzed_content = v_analyzed_content,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log completion
  PERFORM public.xdelo_log_event(
    'caption_processing_completed',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'telegram_message_id', v_message.telegram_message_id,
      'chat_id', v_message.chat_id,
      'media_group_id', v_message.media_group_id,
      'message_type', v_message.message_type
    )
  );
  
  -- If this is part of a media group, sync the caption to other items
  IF v_message.media_group_id IS NOT NULL THEN
    -- Call the media group sync function if it exists
    BEGIN
      PERFORM public.xdelo_sync_media_group(
        p_message_id,
        v_message.media_group_id,
        p_correlation_id,
        false,
        false
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      PERFORM public.xdelo_log_event(
        'media_group_sync_error',
        p_message_id,
        p_correlation_id,
        jsonb_build_object(
          'error', SQLERRM,
          'media_group_id', v_message.media_group_id
        ),
        SQLERRM
      );
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Caption processed successfully',
    'message_id', p_message_id,
    'media_group_synced', v_message.media_group_id IS NOT NULL
  );
END;
$$;
