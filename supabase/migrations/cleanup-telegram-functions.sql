-- Migration: Cleanup Telegram Processing Functions
-- Description: Consolidates and streamlines database functions for Telegram message processing

-- ========== HELPER FUNCTIONS ==========

-- Create improved log event function (replacing multiple redundant logging functions)
CREATE OR REPLACE FUNCTION public.xdelo_log_event(
  p_event_type audit_event_type,
  p_entity_id uuid,
  p_telegram_message_id bigint DEFAULT NULL,
  p_chat_id bigint DEFAULT NULL,
  p_previous_state jsonb DEFAULT NULL,
  p_new_state jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL,
  p_correlation_id text DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.unified_audit_logs (
    event_type,
    entity_id,
    telegram_message_id,
    chat_id,
    previous_state,
    new_state,
    metadata,
    correlation_id,
    error_message
  ) VALUES (
    p_event_type,
    p_entity_id,
    p_telegram_message_id,
    p_chat_id,
    p_previous_state,
    p_new_state,
    p_metadata,
    p_correlation_id,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Create improved message state update function
CREATE OR REPLACE FUNCTION public.xdelo_update_message_state(
  p_message_id uuid,
  p_state message_processing_state,
  p_correlation_id text DEFAULT NULL,
  p_analyzed_content jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_message messages;
  v_timestamp timestamptz := now();
  v_media_group_id text;
  v_result jsonb;
BEGIN
  -- Get the message
  SELECT * INTO v_message FROM messages WHERE id = p_message_id;
  
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Message not found',
      'message_id', p_message_id
    );
  END IF;
  
  v_media_group_id := v_message.media_group_id;
  
  -- Update the message based on the target state
  CASE p_state
    WHEN 'pending' THEN
      UPDATE messages SET
        processing_state = 'pending',
        updated_at = v_timestamp,
        correlation_id = COALESCE(p_correlation_id, correlation_id)
      WHERE id = p_message_id;
    
    WHEN 'processing' THEN
      UPDATE messages SET
        processing_state = 'processing',
        processing_started_at = v_timestamp,
        updated_at = v_timestamp,
        correlation_id = COALESCE(p_correlation_id, correlation_id),
        processing_correlation_id = p_correlation_id
      WHERE id = p_message_id;
      
      -- Log processing start
      PERFORM xdelo_log_event(
        'message_processing_started'::audit_event_type,
        p_message_id,
        v_message.telegram_message_id,
        v_message.chat_id,
        NULL,
        NULL,
        jsonb_build_object(
          'processor', 'database-function',
          'start_time', v_timestamp,
          'media_group_id', v_media_group_id
        ),
        p_correlation_id
      );
    
    WHEN 'completed' THEN
      IF p_analyzed_content IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Analyzed content is required for completed state',
          'message_id', p_message_id
        );
      END IF;
      
      UPDATE messages SET
        processing_state = 'completed',
        processing_completed_at = v_timestamp,
        analyzed_content = p_analyzed_content,
        updated_at = v_timestamp,
        correlation_id = COALESCE(p_correlation_id, correlation_id),
        is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
        group_caption_synced = true
      WHERE id = p_message_id;
      
      -- Log completion
      PERFORM xdelo_log_event(
        'message_processing_completed'::audit_event_type,
        p_message_id,
        v_message.telegram_message_id,
        v_message.chat_id,
        NULL,
        p_analyzed_content,
        jsonb_build_object(
          'processor', 'database-function',
          'completion_time', v_timestamp,
          'media_group_id', v_media_group_id
        ),
        p_correlation_id
      );
    
    WHEN 'error' THEN
      UPDATE messages SET
        processing_state = 'error',
        error_message = p_error_message,
        updated_at = v_timestamp,
        correlation_id = COALESCE(p_correlation_id, correlation_id)
      WHERE id = p_message_id;
      
      -- Log error
      PERFORM xdelo_log_event(
        'message_processing_error'::audit_event_type,
        p_message_id,
        v_message.telegram_message_id,
        v_message.chat_id,
        NULL,
        NULL,
        jsonb_build_object(
          'processor', 'database-function',
          'error_time', v_timestamp,
          'media_group_id', v_media_group_id
        ),
        p_correlation_id,
        p_error_message
      );
  END CASE;
  
  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'message_id', p_message_id,
    'state', p_state
  );
  
  -- For completed messages with media groups, add info but don't sync here
  -- (this is now handled by the edge function)
  IF p_state = 'completed' AND v_media_group_id IS NOT NULL THEN
    v_result := v_result || jsonb_build_object(
      'media_group_id', v_media_group_id,
      'media_group_sync_required', true
    );
  END IF;
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message_id', p_message_id
    );
END;
$$;

-- Improved message existence check function
CREATE OR REPLACE FUNCTION public.xdelo_check_message_exists(
  p_message_id uuid
) RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.messages WHERE id = p_message_id);
END;
$$;

-- ========== CORE PROCESSING FUNCTIONS ==========

-- Improved media group synchronization function
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group(
  p_source_message_id uuid,
  p_media_group_id text,
  p_correlation_id text DEFAULT NULL,
  p_force boolean DEFAULT false,
  p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_message record;
  v_result jsonb;
  v_updated_count integer := 0;
  v_error text;
  v_lock_acquired boolean;
BEGIN
  -- Acquire advisory lock on media group to prevent concurrent syncs
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext(p_media_group_id));
  
  IF NOT v_lock_acquired THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Could not acquire lock on media group, another sync operation is in progress',
      'media_group_id', p_media_group_id
    );
  END IF;

  -- Input validation
  IF p_source_message_id IS NULL OR p_media_group_id IS NULL OR p_media_group_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid parameters: source_message_id and media_group_id required',
      'source_message_id', p_source_message_id,
      'media_group_id', p_media_group_id
    );
  END IF;

  -- Get the source message
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id
  FOR UPDATE;
  
  IF NOT FOUND OR v_source_message.analyzed_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message not found or has no analyzed content',
      'message_id', p_source_message_id
    );
  END IF;
  
  -- Mark source message as the original caption holder
  UPDATE messages
  SET 
    is_original_caption = true,
    group_caption_synced = true,
    updated_at = NOW()
  WHERE id = p_source_message_id;
  
  -- Update all other messages in the group with the analyzed content
  WITH updated_messages AS (
    UPDATE messages
    SET 
      analyzed_content = v_source_message.analyzed_content,
      processing_state = 'completed',
      group_caption_synced = true,
      message_caption_id = p_source_message_id,
      is_original_caption = false,
      processing_completed_at = COALESCE(processing_completed_at, NOW()),
      updated_at = NOW(),
      -- Only sync edit history if requested
      old_analyzed_content = CASE 
        WHEN p_sync_edit_history AND v_source_message.old_analyzed_content IS NOT NULL 
        THEN v_source_message.old_analyzed_content
        ELSE old_analyzed_content
      END
    WHERE 
      media_group_id = p_media_group_id 
      AND id != p_source_message_id
      AND (p_force = true OR group_caption_synced = false OR analyzed_content IS NULL)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated_messages;
  
  -- Update media group metadata for all messages
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
  PERFORM xdelo_log_event(
    'media_group_synced'::audit_event_type,
    p_source_message_id,
    v_source_message.telegram_message_id,
    v_source_message.chat_id,
    NULL,
    NULL,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'updated_messages_count', v_updated_count,
      'force_sync', p_force,
      'sync_edit_history', p_sync_edit_history
    ),
    p_correlation_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id, 
    'updated_count', v_updated_count
  );
EXCEPTION
  WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Log error
    PERFORM xdelo_log_event(
      'media_group_sync_error'::audit_event_type,
      p_source_message_id,
      v_source_message.telegram_message_id,
      v_source_message.chat_id,
      NULL,
      NULL,
      jsonb_build_object(
        'media_group_id', p_media_group_id,
        'error', v_error
      ),
      p_correlation_id,
      v_error
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error,
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id
    );
END;
$$;

-- Improved find caption message function
CREATE OR REPLACE FUNCTION public.xdelo_find_caption_message(
  p_media_group_id text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  -- First try to find a message that has caption and analyzed content
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
    AND analyzed_content IS NOT NULL
    AND is_original_caption = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;

  -- If not found, try to find any message with caption
  SELECT id INTO v_message_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND caption IS NOT NULL
    AND caption != ''
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_message_id IS NOT NULL THEN
    RETURN v_message_id;
  END IF;

  -- If still not found, return NULL
  RETURN NULL;
END;
$$;

-- Improved check media group consistency function to work with edge functions
CREATE OR REPLACE FUNCTION public.xdelo_check_media_group_consistency()
RETURNS SETOF record
LANGUAGE plpgsql
AS $$
DECLARE
  v_group record;
  v_source_message_id uuid;
  media_group_id text;
  source_message_id uuid;
  updated_count integer;
BEGIN
  -- Find media groups that have sync issues
  FOR v_group IN 
    SELECT 
      mg.media_group_id
    FROM (
      SELECT 
        media_group_id,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE analyzed_content IS NULL) as missing_content_count,
        COUNT(*) FILTER (WHERE group_caption_synced = false) as unsynced_count
      FROM 
        messages
      WHERE 
        media_group_id IS NOT NULL
        AND deleted_from_telegram = false
      GROUP BY 
        media_group_id
    ) mg
    WHERE 
      mg.missing_content_count > 0
      OR mg.unsynced_count > 0
    LIMIT 100
  LOOP
    -- Find a suitable caption message
    v_source_message_id := xdelo_find_caption_message(v_group.media_group_id);
    
    IF v_source_message_id IS NOT NULL THEN
      -- Sync the group using the new function
      DECLARE
        v_result jsonb;
      BEGIN
        v_result := xdelo_sync_media_group(
          v_source_message_id,
          v_group.media_group_id,
          'repair_' || gen_random_uuid()::text,
          true,  -- Force sync
          true   -- Always sync edit history during repairs
        );
        
        IF (v_result->>'success')::boolean THEN
          media_group_id := v_group.media_group_id;
          source_message_id := v_source_message_id;
          updated_count := (v_result->>'updated_count')::integer;
          RETURN NEXT;
        END IF;
      END;
    END IF;
  END LOOP;
END;
$$;

-- ========== TRIGGERS ==========

-- Create or replace the message update trigger handler to use new function
CREATE OR REPLACE FUNCTION public.handle_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If caption changed, this will trigger a re-analysis
  IF NEW.caption != OLD.caption OR (NEW.caption IS NOT NULL AND OLD.caption IS NULL) THEN
    -- Store previous analyzed content in the array if it exists
    IF OLD.analyzed_content IS NOT NULL THEN
      NEW.old_analyzed_content = array_append(
        COALESCE(OLD.old_analyzed_content, ARRAY[]::jsonb[]),
        OLD.analyzed_content
      );
    END IF;
    
    -- Reset analysis state
    NEW.analyzed_content = NULL;
    NEW.processing_state = 'pending';
    NEW.group_caption_synced = false;
    
    -- Add to edit history
    NEW.edit_history = COALESCE(OLD.edit_history, '[]'::jsonb) || jsonb_build_object(
      'edit_date', CURRENT_TIMESTAMP,
      'previous_caption', OLD.caption,
      'new_caption', NEW.caption,
      'is_channel_post', NEW.chat_type = 'channel',
      'previous_analyzed_content', OLD.analyzed_content
    );
    
    -- Log the edit
    PERFORM xdelo_log_event(
      'message_edited'::audit_event_type,
      NEW.id,
      NEW.telegram_message_id,
      NEW.chat_id,
      jsonb_build_object('caption', OLD.caption, 'analyzed_content', OLD.analyzed_content),
      jsonb_build_object('caption', NEW.caption),
      jsonb_build_object(
        'media_group_id', NEW.media_group_id,
        'is_channel_post', NEW.chat_type = 'channel'
      ),
      NEW.correlation_id
    );
    
    -- If part of media group, update all related messages
    IF NEW.media_group_id IS NOT NULL THEN
      UPDATE messages
      SET 
        analyzed_content = NULL,
        processing_state = 'pending',
        group_caption_synced = false,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        media_group_id = NEW.media_group_id 
        AND id != NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update check_media_group_on_message_change to use new functions
CREATE OR REPLACE FUNCTION public.check_media_group_on_message_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only proceed for messages in a media group that don't have a caption
  -- and are in 'initialized' or 'pending' state
  IF NEW.media_group_id IS NOT NULL 
     AND (NEW.caption IS NULL OR NEW.caption = '')
     AND NEW.analyzed_content IS NULL
     AND NEW.processing_state IN ('initialized', 'pending') THEN
  
    -- Attempt to sync from media group
    DECLARE
      v_source_message_id uuid;
    BEGIN
      -- Find a suitable caption message
      v_source_message_id := xdelo_find_caption_message(NEW.media_group_id);
      
      IF v_source_message_id IS NOT NULL THEN
        -- Sync content from the found message
        PERFORM xdelo_sync_media_group(
          v_source_message_id,
          NEW.media_group_id,
          COALESCE(NEW.correlation_id, gen_random_uuid()::text)
        );
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ========== DASHBOARD VIEWS ==========

-- Improved view for media group status 
CREATE OR REPLACE VIEW public.v_media_group_status AS
SELECT 
  mg.media_group_id,
  COUNT(*) as total_messages,
  COUNT(*) FILTER (WHERE m.analyzed_content IS NOT NULL) as processed_messages,
  COUNT(*) FILTER (WHERE m.analyzed_content IS NULL) as unprocessed_messages,
  COUNT(*) FILTER (WHERE m.processing_state = 'error') as error_messages,
  COUNT(*) FILTER (WHERE m.group_caption_synced = true) as synced_messages,
  COUNT(*) FILTER (WHERE m.is_original_caption = true) as caption_holders,
  MIN(m.created_at) as first_message_date,
  MAX(m.created_at) as last_message_date,
  AGE(NOW(), MIN(m.created_at)) as age,
  CASE 
    WHEN COUNT(*) FILTER (WHERE m.analyzed_content IS NULL) = 0 THEN 'completed'
    WHEN COUNT(*) FILTER (WHERE m.analyzed_content IS NOT NULL) > 0 AND 
         COUNT(*) FILTER (WHERE m.analyzed_content IS NULL) > 0 THEN 'partial'
    ELSE 'pending'
  END as status
FROM messages m
JOIN (
  SELECT DISTINCT media_group_id 
  FROM messages 
  WHERE media_group_id IS NOT NULL
) mg ON m.media_group_id = mg.media_group_id
GROUP BY mg.media_group_id
ORDER BY MAX(m.created_at) DESC;

-- ========== DEPRECATED FUNCTIONS TO DROP ==========

-- Drop deprecated functions that have been replaced by the new ones
DROP FUNCTION IF EXISTS public.xdelo_process_caption_workflow(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.xdelo_complete_message_processing(uuid, jsonb);
DROP FUNCTION IF EXISTS public.xdelo_set_message_processing(uuid, text);
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content(uuid, text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.make_process_telegram_message_event(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.xdelo_logprocessingevent(text, text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.xdelo_log_message_operation(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.xdelo_log_message_operation(uuid, uuid, text, bigint, bigint, jsonb, text, text, text);
DROP FUNCTION IF EXISTS public.xdelo_validate_message_ids(uuid);
DROP FUNCTION IF EXISTS public.xdelo_parse_caption(text);
DROP FUNCTION IF EXISTS public.extract_media_dimensions(jsonb);

-- Keep these views/functions if still needed or drop if not needed anymore
-- DROP FUNCTION IF EXISTS public.xdelo_find_broken_media_groups();
-- DROP FUNCTION IF EXISTS public.xdelo_get_incomplete_media_groups(integer);
-- DROP FUNCTION IF EXISTS public.xdelo_has_valid_caption(text);
-- DROP FUNCTION IF EXISTS public.xdelo_get_message_forward_history(uuid);
-- DROP FUNCTION IF EXISTS public.xdelo_prepare_message_for_webhook(uuid);
-- DROP FUNCTION IF EXISTS public.xdelo_extract_telegram_metadata(jsonb);

-- Add comment to indicate completion of migration
COMMENT ON FUNCTION public.xdelo_log_event IS 'Consolidated log event function - v1.0.0 - Replaces multiple legacy logging functions';
COMMENT ON FUNCTION public.xdelo_update_message_state IS 'Consolidated message state update function - v1.0.0 - Replaces multiple legacy state update functions';
COMMENT ON FUNCTION public.xdelo_sync_media_group IS 'Improved media group sync function - v1.0.0 - Replaces legacy sync function'; 