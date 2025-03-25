
-- Drop duplicate functions to avoid ambiguity
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content(text, text, text);
DROP FUNCTION IF EXISTS public.xdelo_update_message_with_analyzed_content(uuid, jsonb, text);

-- Improved function for processing message captions
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_workflow(
    p_message_id uuid, 
    p_correlation_id text DEFAULT NULL, 
    p_force boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_message messages;
  v_caption TEXT;
  v_media_group_id TEXT;
  v_analyzed_content JSONB;
  v_correlation_uuid uuid;
BEGIN
  -- Convert correlation_id to UUID if provided, otherwise generate new one
  v_correlation_uuid := CASE 
    WHEN p_correlation_id IS NOT NULL THEN 
      CASE 
        WHEN p_correlation_id::uuid IS NOT NULL THEN p_correlation_id::uuid
        ELSE gen_random_uuid()
      END
    ELSE gen_random_uuid()
  END;

  -- Get the message
  SELECT * INTO v_message FROM messages WHERE id = p_message_id;
  
  IF v_message IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Message not found',
      'message_id', p_message_id
    );
  END IF;
  
  -- Check if already processed and force not specified
  IF v_message.processing_state = 'completed' AND NOT p_force THEN
    RETURN jsonb_build_object(
      'success', FALSE, 
      'message', 'Message already processed',
      'message_id', p_message_id
    );
  END IF;
  
  -- Update to processing state
  UPDATE messages
  SET processing_state = 'processing',
      processing_started_at = NOW(),
      updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the processing start
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_processing_started',
    p_message_id,
    v_correlation_uuid::text,
    jsonb_build_object(
      'processor', 'xdelo_process_caption_workflow',
      'start_time', NOW(),
      'caption_length', length(v_message.caption),
      'force', p_force
    ),
    NOW()
  );
  
  v_caption := v_message.caption;
  v_media_group_id := v_message.media_group_id;
  
  -- Check if caption exists
  IF v_caption IS NULL OR v_caption = '' THEN
    -- No caption to process, mark as completed if not part of a media group
    IF v_media_group_id IS NULL THEN
      UPDATE messages
      SET processing_state = 'completed',
          processing_completed_at = NOW(),
          analyzed_content = jsonb_build_object(
            'caption', '',
            'parsing_metadata', jsonb_build_object(
              'method', 'empty_caption',
              'timestamp', NOW()
            )
          ),
          updated_at = NOW()
      WHERE id = p_message_id;
      
      RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'No caption to process, marked as completed',
        'message_id', p_message_id
      );
    ELSE
      -- For media group messages without caption, check if we can sync from another message
      RETURN public.xdelo_check_media_group_content(
        v_media_group_id, 
        p_message_id, 
        v_correlation_uuid::text
      );
    END IF;
  END IF;
  
  -- We have a caption, parse it directly and update the message
  -- This is a key change - instead of relying on other processes, do the parsing right here
  v_analyzed_content := public.xdelo_parse_caption(v_caption);
  
  -- Add metadata about this processing operation
  v_analyzed_content := jsonb_set(
    v_analyzed_content,
    '{parsing_metadata}',
    (v_analyzed_content->'parsing_metadata') || jsonb_build_object(
      'processed_by', 'xdelo_process_caption_workflow',
      'process_timestamp', NOW(),
      'correlation_id', v_correlation_uuid
    )
  );

  -- Update the message with analyzed content
  UPDATE messages
  SET analyzed_content = v_analyzed_content,
      processing_state = 'completed',
      processing_completed_at = NOW(),
      is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
      updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the analysis completion
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_analysis_completed',
    p_message_id,
    v_correlation_uuid::text,
    jsonb_build_object(
      'processor', 'xdelo_process_caption_workflow',
      'completion_time', NOW(),
      'has_media_group', v_media_group_id IS NOT NULL
    ),
    NOW()
  );
  
  -- If part of a media group, sync the analyzed content to other messages
  IF v_media_group_id IS NOT NULL THEN
    PERFORM public.xdelo_sync_media_group_content(
      p_message_id,
      v_media_group_id,
      v_correlation_uuid::text,
      true, -- Force sync
      false -- Don't sync edit history for normal processing
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message_id', p_message_id,
    'media_group_id', v_media_group_id,
    'is_media_group', v_media_group_id IS NOT NULL,
    'caption', v_caption,
    'correlation_id', v_correlation_uuid,
    'analyzed_content', v_analyzed_content
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Update to error state
    UPDATE messages
    SET processing_state = 'error',
        error_message = SQLERRM,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      correlation_id,
      error_message,
      metadata,
      event_timestamp
    ) VALUES (
      'message_processing_error',
      p_message_id,
      v_correlation_uuid::text,
      SQLERRM,
      jsonb_build_object(
        'processor', 'xdelo_process_caption_workflow',
        'error_time', NOW()
      ),
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'message_id', p_message_id,
      'error', SQLERRM
    );
END;
$$;

-- Improved function for syncing media group content
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
    p_source_message_id uuid, 
    p_media_group_id text, 
    p_correlation_id text DEFAULT NULL,
    p_force_sync boolean DEFAULT false,
    p_sync_edit_history boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_source_message messages;
  v_result JSONB;
  v_updated_count INTEGER := 0;
  v_error TEXT;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Acquire advisory lock on media group to prevent concurrent syncs
  -- We use hashtext to convert the media_group_id string to a bigint
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext(p_media_group_id));
  
  IF NOT v_lock_acquired THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Could not acquire lock on media group, another sync operation is in progress',
      'media_group_id', p_media_group_id
    );
  END IF;

  -- Input validation
  IF p_source_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message ID cannot be null',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  IF p_media_group_id IS NULL OR p_media_group_id = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Media group ID cannot be null or empty',
      'media_group_id', p_media_group_id
    );
  END IF;

  -- Get the source message with analyzed content
  SELECT * INTO v_source_message
  FROM messages
  WHERE id = p_source_message_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message not found',
      'message_id', p_source_message_id
    );
  END IF;
  
  -- Verify source message has analyzed content
  IF v_source_message.analyzed_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Source message has no analyzed content',
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
  
  -- Update all other messages in the group with the analyzed content - BATCH UPDATE
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
      -- Only sync edit history if specifically requested
      old_analyzed_content = CASE 
        WHEN p_sync_edit_history AND v_source_message.old_analyzed_content IS NOT NULL 
        THEN v_source_message.old_analyzed_content
        ELSE old_analyzed_content
      END,
      edit_history = CASE
        WHEN p_sync_edit_history AND v_source_message.edit_history IS NOT NULL
        THEN v_source_message.edit_history
        ELSE edit_history
      END
    WHERE 
      media_group_id = p_media_group_id 
      AND id != p_source_message_id
      AND (
        p_force_sync = true OR 
        group_caption_synced = false OR 
        analyzed_content IS NULL OR
        analyzed_content IS DISTINCT FROM v_source_message.analyzed_content
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated_messages;
  
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
    correlation_id,
    event_timestamp
  ) VALUES (
    'media_group_content_synced',
    p_source_message_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id,
      'updated_messages_count', v_updated_count,
      'operation', 'sync_group',
      'force_sync', p_force_sync,
      'sync_edit_history', p_sync_edit_history
    ),
    p_correlation_id,
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'media_group_id', p_media_group_id,
    'source_message_id', p_source_message_id, 
    'updated_count', v_updated_count,
    'correlation_id', p_correlation_id,
    'force_sync', p_force_sync,
    'sync_edit_history', p_sync_edit_history,
    'analyzed_content_synced', v_source_message.analyzed_content IS NOT NULL
  );
EXCEPTION
  WHEN OTHERS THEN
    v_error := SQLERRM;
    
    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      entity_id,
      error_message,
      metadata,
      correlation_id,
      event_timestamp
    ) VALUES (
      'media_group_sync_error',
      p_source_message_id,
      v_error,
      jsonb_build_object(
        'media_group_id', p_media_group_id,
        'operation', 'sync_group',
        'force_sync', p_force_sync,
        'sync_edit_history', p_sync_edit_history
      ),
      p_correlation_id,
      NOW()
    );
    
    RETURN jsonb_build_object(
      'success', false,
      'error', v_error,
      'media_group_id', p_media_group_id,
      'source_message_id', p_source_message_id
    );
END;
$$;

-- Add a trigger to ensure the analyzed content is extracted to separate columns for easier querying
CREATE OR REPLACE FUNCTION public.xdelo_extract_analyzed_content()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only proceed if analyzed_content has changed and is not null
    IF (TG_OP = 'INSERT' OR OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content) 
       AND NEW.analyzed_content IS NOT NULL THEN
        
        -- Extract fields from analyzed_content
        NEW.product_name := NEW.analyzed_content->>'product_name';
        NEW.product_code := NEW.analyzed_content->>'product_code';
        NEW.vendor_uid := NEW.analyzed_content->>'vendor_uid';
        NEW.purchase_date := (NEW.analyzed_content->>'purchase_date')::date;
        NEW.product_quantity := (NEW.analyzed_content->>'quantity')::numeric;
        NEW.notes := NEW.analyzed_content->>'notes';
        
        -- Update modification timestamp
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Make sure the trigger is properly set
DROP TRIGGER IF EXISTS xdelo_trg_extract_analyzed_content ON messages;
CREATE TRIGGER xdelo_trg_extract_analyzed_content
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_extract_analyzed_content();

-- Add a function to manually reprocess a batch of messages
CREATE OR REPLACE FUNCTION public.xdelo_reprocess_messages(p_limit integer DEFAULT 50)
RETURNS TABLE(
    message_id uuid,
    media_group_id text,
    success boolean,
    error text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message record;
    v_result jsonb;
    v_correlation_id uuid := gen_random_uuid();
BEGIN
    FOR v_message IN 
        SELECT id, media_group_id, caption
        FROM messages
        WHERE (
            processed_content IS NULL OR 
            analyzed_content IS NULL OR
            processing_state = 'pending' OR
            processing_state = 'error'
        )
        AND deleted_from_telegram = false
        AND caption IS NOT NULL
        ORDER BY created_at DESC
        LIMIT p_limit
    LOOP
        BEGIN
            v_result := public.xdelo_process_caption_workflow(
                v_message.id,
                v_correlation_id::text,
                true -- Force reprocessing
            );
            
            message_id := v_message.id;
            media_group_id := v_message.media_group_id;
            success := (v_result->>'success')::boolean;
            error := v_result->>'error';
            
            RETURN NEXT;
        EXCEPTION WHEN OTHERS THEN
            message_id := v_message.id;
            media_group_id := v_message.media_group_id;
            success := false;
            error := SQLERRM;
            
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

-- Add a function to clean up the database and remove unnecessary functions
CREATE OR REPLACE FUNCTION public.xdelo_cleanup_duplicate_functions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
    v_count int := 0;
BEGIN
    -- List of functions to check for duplicates
    DECLARE
        function_names text[] := ARRAY[
            'xdelo_sync_media_group_content',
            'xdelo_update_message_with_analyzed_content',
            'xdelo_process_caption_workflow'
        ];
        function_name text;
    BEGIN
        FOREACH function_name IN ARRAY function_names
        LOOP
            -- Find and count duplicates
            WITH function_duplicates AS (
                SELECT 
                    proname, 
                    pronargs, 
                    proargtypes,
                    COUNT(*) OVER (PARTITION BY proname, pronargs, proargtypes) as duplicate_count
                FROM pg_proc
                WHERE proname = function_name
                AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            )
            SELECT json_agg(json_build_object(
                'function_name', proname,
                'duplicate_count', duplicate_count
            ))
            INTO v_result
            FROM function_duplicates
            WHERE duplicate_count > 1;
            
            -- If duplicates found, increment count
            IF v_result IS NOT NULL THEN
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END;

    RETURN jsonb_build_object(
        'functions_checked', array_length(function_names, 1),
        'duplicates_found', v_count,
        'details', COALESCE(v_result, '[]'::jsonb)
    );
END;
$$;

-- Re-enable any disabled triggers for media group syncing
DO $$
DECLARE
    v_trigger record;
BEGIN
    FOR v_trigger IN 
        SELECT tgname, tgenabled 
        FROM pg_trigger 
        WHERE tgrelid = 'messages'::regclass 
        AND tgname IN (
            'trg_check_media_group_on_message_change',
            'trg_ensure_edit_history_consistency',
            'trg_extract_analyzed_content',
            'trg_validate_media_group_sync'
        )
    LOOP
        IF v_trigger.tgenabled = 'D' THEN
            EXECUTE format('ALTER TABLE messages ENABLE TRIGGER %I', v_trigger.tgname);
        END IF;
    END LOOP;
END $$;
