-- Migration up: Function Consolidation
-- Description: This migration ensures that all necessary database functions exist for the consolidated edge functions
-- Author: System
-- Date: 2024-04-15

-- Create the compatibility wrapper for xdelo_logprocessingevent if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'xdelo_logprocessingevent') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.xdelo_logprocessingevent(
        p_event_type text,
        p_entity_id text,
        p_correlation_id text DEFAULT NULL,
        p_metadata jsonb DEFAULT NULL,
        p_error_message text DEFAULT NULL
      ) RETURNS void AS $$
      BEGIN
        -- Call the consolidated logging function
        PERFORM public.xdelo_log_event(
          p_event_type,
          p_entity_id::uuid,
          p_correlation_id,
          p_metadata,
          p_error_message
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      COMMENT ON FUNCTION public.xdelo_logprocessingevent IS ''Compatibility wrapper for xdelo_log_event to support legacy code'';
    ';
  END IF;
END $$;

-- Ensure xdelo_process_caption_workflow exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'xdelo_process_caption_workflow') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
        p_message_id uuid,
        p_correlation_id text DEFAULT NULL,
        p_force boolean DEFAULT false
      ) RETURNS jsonb AS $$
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
            ''success'', false,
            ''error'', ''Message not found'',
            ''message_id'', p_message_id
          );
        END IF;
        
        -- Skip if message already processed and force is false
        IF v_message.processing_state = ''completed'' AND NOT p_force THEN
          RETURN jsonb_build_object(
            ''success'', true,
            ''message'', ''Message already processed'',
            ''skipped'', true,
            ''message_id'', p_message_id
          );
        END IF;
        
        -- Update to processing state
        UPDATE messages
        SET 
          processing_state = ''processing'',
          processing_started_at = NOW(),
          updated_at = NOW()
        WHERE id = p_message_id;
        
        -- Log processing started
        PERFORM public.xdelo_log_event(
          ''caption_processing_started'',
          p_message_id,
          p_correlation_id,
          jsonb_build_object(
            ''telegram_message_id'', v_message.telegram_message_id,
            ''chat_id'', v_message.chat_id,
            ''media_group_id'', v_message.media_group_id,
            ''message_type'', v_message.message_type
          )
        );
        
        -- Get the caption text to analyze
        v_caption := COALESCE(v_message.caption, v_message.text, '''');
        
        -- If empty caption, just mark as completed with empty analysis
        IF v_caption = '''' THEN
          UPDATE messages
          SET 
            processing_state = ''completed'',
            processing_completed_at = NOW(),
            analyzed_content = ''{"parsing_metadata":{"success":true,"empty_content":true}}''::jsonb,
            updated_at = NOW()
          WHERE id = p_message_id;
          
          RETURN jsonb_build_object(
            ''success'', true,
            ''message'', ''Empty caption processed'',
            ''message_id'', p_message_id
          );
        END IF;
        
        -- For non-empty captions, analyze the content
        -- This is a simplified parsing implementation
        -- In a real system, this would include more complex parsing logic
        v_analyzed_content := jsonb_build_object(
          ''parsing_metadata'', jsonb_build_object(
            ''success'', true,
            ''parsing_time'', extract(epoch from now())::text,
            ''trigger_source'', ''database_function''
          ),
          ''raw_text'', v_caption,
          ''parsed_at'', now()
        );
        
        -- Update the message with analyzed content
        UPDATE messages
        SET 
          processing_state = ''completed'',
          processing_completed_at = NOW(),
          analyzed_content = v_analyzed_content,
          updated_at = NOW()
        WHERE id = p_message_id;
        
        -- Log completion
        PERFORM public.xdelo_log_event(
          ''caption_processing_completed'',
          p_message_id,
          p_correlation_id,
          jsonb_build_object(
            ''telegram_message_id'', v_message.telegram_message_id,
            ''chat_id'', v_message.chat_id,
            ''media_group_id'', v_message.media_group_id,
            ''message_type'', v_message.message_type
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
              ''media_group_sync_error'',
              p_message_id,
              p_correlation_id,
              jsonb_build_object(
                ''error'', SQLERRM,
                ''media_group_id'', v_message.media_group_id
              ),
              SQLERRM
            );
          END;
        END IF;
        
        RETURN jsonb_build_object(
          ''success'', true,
          ''message'', ''Caption processed successfully'',
          ''message_id'', p_message_id,
          ''media_group_synced'', v_message.media_group_id IS NOT NULL
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      COMMENT ON FUNCTION public.xdelo_process_caption_workflow IS ''Process message captions and synchronize within media groups'';
    ';
  END IF;
END $$;

-- Create or replace the update_message_state function
CREATE OR REPLACE FUNCTION public.xdelo_update_message_state(
  p_message_id uuid,
  p_state text,
  p_correlation_id text DEFAULT NULL,
  p_analyzed_content jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_message messages;
  v_previous_state jsonb;
  v_event_type text;
BEGIN
  -- Validate state
  IF p_state NOT IN ('pending', 'processing', 'completed', 'error') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid state: ' || p_state,
      'message_id', p_message_id
    );
  END IF;
  
  -- Get the current message state
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Message not found',
      'message_id', p_message_id
    );
  END IF;
  
  -- Store previous state for logging
  v_previous_state := jsonb_build_object(
    'processing_state', v_message.processing_state,
    'analyzed_content', v_message.analyzed_content,
    'error_message', v_message.error_message
  );
  
  -- Determine the appropriate event type
  CASE p_state
    WHEN 'pending' THEN v_event_type := 'message_state_pending';
    WHEN 'processing' THEN v_event_type := 'message_state_processing';
    WHEN 'completed' THEN v_event_type := 'message_state_completed';
    WHEN 'error' THEN v_event_type := 'message_state_error';
    ELSE v_event_type := 'message_state_changed';
  END CASE;
  
  -- Update the message state
  UPDATE messages
  SET 
    processing_state = p_state,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Additional updates based on state
  IF p_state = 'pending' THEN
    UPDATE messages
    SET processing_started_at = NULL
    WHERE id = p_message_id;
  ELSIF p_state = 'processing' THEN
    UPDATE messages
    SET processing_started_at = NOW()
    WHERE id = p_message_id;
  ELSIF p_state = 'completed' THEN
    UPDATE messages
    SET
      processing_completed_at = NOW(),
      analyzed_content = p_analyzed_content,
      error_message = NULL
    WHERE id = p_message_id;
  ELSIF p_state = 'error' THEN
    UPDATE messages
    SET
      processing_completed_at = NOW(),
      error_message = p_error_message
    WHERE id = p_message_id;
  END IF;
  
  -- Log the state change
  PERFORM public.xdelo_log_event(
    v_event_type,
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'previous_state', v_previous_state,
      'new_state', p_state,
      'telegram_message_id', v_message.telegram_message_id,
      'chat_id', v_message.chat_id,
      'has_analyzed_content', p_analyzed_content IS NOT NULL
    ),
    p_error_message
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message_id', p_message_id,
    'state', p_state
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.xdelo_update_message_state IS 'Update message processing state with comprehensive logging';

-- Ensure the consolidated xdelo_log_event function exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'xdelo_log_event') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.xdelo_log_event(
        p_event_type text,
        p_entity_id text,
        p_correlation_id text DEFAULT NULL,
        p_metadata jsonb DEFAULT NULL,
        p_error_message text DEFAULT NULL
      ) RETURNS uuid AS $$
      DECLARE
        v_log_id uuid;
      BEGIN
        INSERT INTO unified_audit_logs(
          event_type,
          entity_id,
          correlation_id,
          metadata,
          error_message
        ) VALUES (
          p_event_type,
          p_entity_id::uuid,
          p_correlation_id,
          COALESCE(p_metadata, ''{}''::jsonb),
          p_error_message
        )
        RETURNING id INTO v_log_id;
        
        RETURN v_log_id;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      COMMENT ON FUNCTION public.xdelo_log_event IS ''Consolidated logging function for all operations'';
    ';
  END IF;
END $$;

-- Ensure sync_media_group function exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'xdelo_sync_media_group') THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group(
        p_source_message_id uuid,
        p_media_group_id text,
        p_correlation_id text DEFAULT NULL,
        p_force_sync boolean DEFAULT false,
        p_sync_edit_history boolean DEFAULT false
      ) RETURNS jsonb AS $$
      DECLARE
        v_source_message messages;
        v_group_messages uuid[];
        v_synced_count INTEGER := 0;
        v_update_data jsonb;
        v_result jsonb;
        v_lock_key text;
      BEGIN
        -- Generate a lock key to prevent concurrent syncs of the same group
        v_lock_key := ''media_group_sync_'' || p_media_group_id;
        
        -- Try to acquire an advisory lock to prevent concurrent syncs
        IF NOT pg_try_advisory_xact_lock(hashtext(v_lock_key)) THEN
          RETURN jsonb_build_object(
            ''success'', FALSE,
            ''synced_count'', 0,
            ''media_group_id'', p_media_group_id,
            ''error'', ''Could not acquire lock for media group synchronization''
          );
        END IF;
        
        -- Get the source message
        SELECT * INTO v_source_message
        FROM messages
        WHERE id = p_source_message_id;
        
        IF v_source_message IS NULL THEN
          RETURN jsonb_build_object(
            ''success'', FALSE,
            ''synced_count'', 0,
            ''media_group_id'', p_media_group_id,
            ''error'', ''Source message not found''
          );
        END IF;

        -- Check if source message has analyzed content or caption
        IF v_source_message.analyzed_content IS NULL AND NOT p_force_sync THEN
          RETURN jsonb_build_object(
            ''success'', FALSE,
            ''synced_count'', 0,
            ''media_group_id'', p_media_group_id,
            ''error'', ''Source message has no analyzed content''
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
            ''success'', TRUE,
            ''synced_count'', 0,
            ''media_group_id'', p_media_group_id
          );
        END IF;
        
        -- Prepare the update data - sync caption (not text) across media group
        v_update_data := jsonb_build_object(
          ''analyzed_content'', v_source_message.analyzed_content,
          ''caption'', v_source_message.caption,
          ''message_caption_id'', p_source_message_id,
          ''is_original_caption'', FALSE,
          ''group_caption_synced'', TRUE,
          ''processing_state'', ''completed'',
          ''processing_completed_at'', NOW(),
          ''updated_at'', NOW()
        );
        
        -- Add edit history if requested
        IF p_sync_edit_history AND v_source_message.edit_history IS NOT NULL THEN
          v_update_data := v_update_data || jsonb_build_object(''edit_history'', v_source_message.edit_history);
        END IF;
        
        -- Update all group messages
        WITH updates AS (
          UPDATE messages
          SET 
            analyzed_content = v_update_data->''analyzed_content'',
            caption = v_update_data->''caption'',
            message_caption_id = (v_update_data->''message_caption_id'')::uuid,
            is_original_caption = (v_update_data->''is_original_caption'')::boolean,
            group_caption_synced = (v_update_data->''group_caption_synced'')::boolean,
            processing_state = v_update_data->''processing_state'',
            processing_completed_at = (v_update_data->''processing_completed_at'')::timestamp with time zone,
            updated_at = (v_update_data->''updated_at'')::timestamp with time zone,
            edit_history = CASE 
                            WHEN p_sync_edit_history THEN v_source_message.edit_history
                            ELSE edit_history
                        END
          WHERE id = ANY(v_group_messages)
          RETURNING id
        )
        SELECT COUNT(*) INTO v_synced_count FROM updates;
        
        -- Log sync operation
        PERFORM public.xdelo_log_event(
          ''media_group_synced'',
          p_source_message_id,
          p_correlation_id,
          jsonb_build_object(
            ''media_group_id'', p_media_group_id,
            ''synced_count'', v_synced_count,
            ''group_size'', ARRAY_LENGTH(v_group_messages, 1) + 1
          )
        );
        
        RETURN jsonb_build_object(
          ''success'', TRUE,
          ''synced_count'', v_synced_count,
          ''media_group_id'', p_media_group_id,
          ''source_message_id'', p_source_message_id
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;

      COMMENT ON FUNCTION public.xdelo_sync_media_group IS ''Synchronize analyzed content across media group messages'';
    ';
  END IF;
END $$;

-- Create a view to help monitor function operations
CREATE OR REPLACE VIEW v_function_operations AS
SELECT 
  event_type,
  COUNT(*) as event_count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence,
  COUNT(DISTINCT correlation_id) as unique_operations,
  COUNT(DISTINCT entity_id) as unique_entities,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as error_count
FROM unified_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY event_count DESC;

COMMENT ON VIEW v_function_operations IS 'Operational monitoring for function calls and events';

-- Create a view for monitoring media group operations specifically
CREATE OR REPLACE VIEW v_media_group_operations AS
SELECT 
  ul.event_type,
  ul.correlation_id,
  ul.entity_id as message_id,
  m.media_group_id,
  ul.created_at,
  ul.error_message,
  (ul.metadata->>'synced_count')::int as synced_count,
  ul.metadata->>'group_size' as group_size
FROM unified_audit_logs ul
JOIN messages m ON ul.entity_id = m.id
WHERE 
  ul.event_type IN ('media_group_synced', 'media_group_sync_error') 
  AND ul.created_at > NOW() - INTERVAL '7 days'
  AND m.media_group_id IS NOT NULL
ORDER BY ul.created_at DESC;

COMMENT ON VIEW v_media_group_operations IS 'Monitoring for media group synchronization operations'; 