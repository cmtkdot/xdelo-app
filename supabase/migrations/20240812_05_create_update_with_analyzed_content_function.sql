
-- Start transaction
BEGIN;

-- Consolidated function to update message with analyzed content with transaction support
CREATE OR REPLACE FUNCTION public.xdelo_update_message_with_analyzed_content(
  p_message_id uuid,
  p_analyzed_content jsonb,
  p_correlation_id text DEFAULT NULL,
  p_force_sync boolean DEFAULT true,
  p_sync_edit_history boolean DEFAULT false,
  p_is_edit boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message messages;
  v_media_group_id text;
  v_old_analyzed_content jsonb[];
  v_edit_history jsonb[];
  v_sync_result jsonb;
BEGIN
  -- Get message data with row lock to prevent concurrent updates
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found: %', p_message_id;
  END IF;
  
  -- Store current values for history tracking
  v_media_group_id := v_message.media_group_id;
  
  -- Prepare edit history if needed
  IF p_is_edit AND v_message.analyzed_content IS NOT NULL THEN
    -- Get existing old_analyzed_content array
    v_old_analyzed_content := COALESCE(v_message.old_analyzed_content, ARRAY[]::jsonb[]);
    
    -- Add current content to history
    v_old_analyzed_content := array_append(
      v_old_analyzed_content, 
      jsonb_build_object(
        'content', v_message.analyzed_content,
        'archived_timestamp', NOW(),
        'archived_reason', 'edit'
      )
    );
    
    -- Update edit history
    v_edit_history := COALESCE(v_message.edit_history, ARRAY[]::jsonb[]);
    v_edit_history := array_append(
      v_edit_history,
      jsonb_build_object(
        'timestamp', NOW(),
        'type', 'edit',
        'previous_analyzed_content', v_message.analyzed_content
      )
    );
  END IF;
  
  -- Update the message
  UPDATE messages
  SET 
    analyzed_content = p_analyzed_content,
    processing_state = 'completed',
    processing_completed_at = NOW(),
    is_original_caption = CASE WHEN v_media_group_id IS NOT NULL THEN true ELSE is_original_caption END,
    group_caption_synced = CASE WHEN v_media_group_id IS NOT NULL THEN false ELSE group_caption_synced END,
    old_analyzed_content = CASE WHEN p_is_edit THEN v_old_analyzed_content ELSE old_analyzed_content END,
    edit_history = CASE WHEN p_is_edit THEN v_edit_history ELSE edit_history END,
    edit_count = CASE WHEN p_is_edit THEN COALESCE(edit_count, 0) + 1 ELSE edit_count END,
    updated_at = NOW()
  WHERE id = p_message_id
  RETURNING * INTO v_message;
  
  -- Log the update
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'message_content_updated',
    p_message_id,
    p_correlation_id,
    jsonb_build_object(
      'media_group_id', v_media_group_id,
      'has_caption', v_message.caption IS NOT NULL,
      'is_edit', p_is_edit,
      'operation', 'update_analyzed_content'
    ),
    NOW()
  );
  
  -- Sync with media group if applicable
  IF v_media_group_id IS NOT NULL AND p_force_sync THEN
    v_sync_result := xdelo_sync_media_group_content(
      p_message_id,
      v_media_group_id,
      p_correlation_id,
      true, -- Force sync
      p_sync_edit_history -- Sync edit history if requested
    );
  ELSE
    v_sync_result := jsonb_build_object(
      'success', true,
      'message', 'Message updated, no media group sync performed',
      'message_id', p_message_id,
      'skipped_sync', true
    );
  END IF;
  
  RETURN v_sync_result;
END;
$$;

-- Commit transaction
COMMIT;
