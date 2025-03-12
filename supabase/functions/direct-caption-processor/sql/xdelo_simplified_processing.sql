
-- Consolidated SQL for simplifying the processing state enum and removing unnecessary columns

-- Step 1: Simplify processing_state enum by removing unnecessary states
DO $$
BEGIN
  -- First update any messages using alternative states to standard ones
  UPDATE public.messages 
  SET processing_state = 'completed'
  WHERE processing_state = 'partial_success';
  
  -- Only update the enum if it hasn't been updated already
  IF EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'processing_state' 
    AND typtype = 'e'
    AND (
      SELECT COUNT(*) FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'processing_state')
    ) > 4
  ) THEN
    -- Update the enum type
    ALTER TYPE processing_state RENAME TO processing_state_old;
    CREATE TYPE processing_state AS ENUM ('pending', 'processing', 'completed', 'error');
    
    -- Update the messages table to use the new enum
    ALTER TABLE public.messages 
    ALTER COLUMN processing_state TYPE processing_state 
    USING processing_state::text::processing_state;
    
    -- Drop the old enum
    DROP TYPE processing_state_old;
  END IF;
  
  -- Step 2: Remove unnecessary processing-related columns
  ALTER TABLE public.messages 
  DROP COLUMN IF EXISTS processing_correlation_id,
  DROP COLUMN IF EXISTS sync_attempt,
  DROP COLUMN IF EXISTS processing_attempts,
  DROP COLUMN IF EXISTS last_processing_attempt,
  DROP COLUMN IF EXISTS retry_count,
  DROP COLUMN IF EXISTS fallback_processed;
END
$$;

-- Step 3: Create a simplified caption processing function
CREATE OR REPLACE FUNCTION xdelo_process_caption(
  p_message_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_result JSONB;
  v_caption TEXT;
  v_media_group_id TEXT;
BEGIN
  -- Get the message
  SELECT * INTO v_message FROM messages WHERE id = p_message_id;
  
  -- Check if already processed and force not specified
  IF v_message.processing_state = 'completed' AND NOT p_force THEN
    RETURN jsonb_build_object('success', false, 'message', 'Message already processed');
  END IF;
  
  -- Update to processing state
  UPDATE messages
  SET processing_state = 'processing',
      processing_started_at = NOW()
  WHERE id = p_message_id;
  
  v_caption := v_message.caption;
  v_media_group_id := v_message.media_group_id;
  
  -- Return empty result for edge function processing
  v_result := jsonb_build_object(
    'caption', v_caption,
    'processing_metadata', jsonb_build_object(
      'timestamp', NOW()
    )
  );
  
  -- Update message with pending state for edge function processing
  UPDATE messages
  SET processing_state = 'pending',
      processing_started_at = NOW(),
      is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END
  WHERE id = p_message_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'message_id', p_message_id,
    'media_group_id', v_media_group_id,
    'is_media_group', v_media_group_id IS NOT NULL,
    'caption', v_caption
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Update to error state
    UPDATE messages
    SET processing_state = 'error',
        error_message = SQLERRM
    WHERE id = p_message_id;
    
    RETURN jsonb_build_object(
      'success', false,
      'message_id', p_message_id,
      'error', SQLERRM
    );
END;
$$;

-- Step 4: Create a simplified media group sync function
CREATE OR REPLACE FUNCTION xdelo_sync_media_group_content(
  p_source_message_id UUID,
  p_media_group_id TEXT,
  p_correlation_id TEXT DEFAULT NULL,
  p_force_sync BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_source_message messages;
  v_sync_count INT := 0;
  v_error_count INT := 0;
BEGIN
  -- Get source message with analyzed content
  SELECT * INTO v_source_message 
  FROM messages 
  WHERE id = p_source_message_id;
  
  IF v_source_message.analyzed_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Source message has no analyzed content',
      'source_message_id', p_source_message_id
    );
  END IF;
  
  -- Update all other messages in the media group
  UPDATE messages
  SET 
    analyzed_content = v_source_message.analyzed_content,
    processing_state = 'completed',
    processing_completed_at = COALESCE(processing_completed_at, NOW()),
    group_caption_synced = TRUE,
    updated_at = NOW()
  WHERE 
    media_group_id = p_media_group_id
    AND id != p_source_message_id
    AND (p_force_sync OR processing_state != 'completed');
    
  GET DIAGNOSTICS v_sync_count = ROW_COUNT;
  
  -- Log the sync operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'media_group_content_synced',
    p_source_message_id,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', p_media_group_id,
      'synced_messages', v_sync_count,
      'force_sync', p_force_sync,
      'timestamp', NOW()
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Media group content synced',
    'source_message_id', p_source_message_id,
    'media_group_id', p_media_group_id,
    'synced_messages', v_sync_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Error syncing media group content: ' || SQLERRM,
      'source_message_id', p_source_message_id,
      'media_group_id', p_media_group_id
    );
END;
$$;
