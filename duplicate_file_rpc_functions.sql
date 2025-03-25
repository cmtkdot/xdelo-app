-- Create RPC function to find duplicate files
CREATE OR REPLACE FUNCTION xdelo_find_duplicate_file(
  p_file_unique_id TEXT,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_correlation_id UUID := COALESCE(p_correlation_id::UUID, gen_random_uuid());
BEGIN
  -- Find messages with the same file_unique_id that have analyzed content
  WITH duplicate_files AS (
    SELECT 
      id, 
      analyzed_content,
      created_at,
      telegram_message_id,
      chat_id
    FROM 
      messages
    WHERE 
      file_unique_id = p_file_unique_id
      AND analyzed_content IS NOT NULL
    ORDER BY 
      created_at DESC
    LIMIT 1
  )
  SELECT 
    jsonb_build_object(
      'success', CASE WHEN COUNT(*) > 0 THEN TRUE ELSE FALSE END,
      'message', CASE WHEN COUNT(*) > 0 THEN 'Duplicate file found' ELSE 'No duplicate file found' END,
      'file_unique_id', p_file_unique_id,
      'duplicate_count', COUNT(*),
      'duplicate_file', CASE WHEN COUNT(*) > 0 THEN
        jsonb_build_object(
          'id', df.id,
          'telegram_message_id', df.telegram_message_id,
          'chat_id', df.chat_id,
          'created_at', df.created_at
        )
      ELSE NULL END,
      'analyzed_content', CASE WHEN COUNT(*) > 0 THEN df.analyzed_content ELSE NULL END
    ) INTO v_result
  FROM 
    duplicate_files df;
  
  -- Log that we searched for duplicates
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    correlation_id
  ) VALUES (
    'duplicate_file_search',
    v_correlation_id::TEXT,
    jsonb_build_object(
      'file_unique_id', p_file_unique_id,
      'has_duplicate', (v_result->>'success')::BOOLEAN,
      'duplicate_message_id', v_result->'duplicate_file'->>'id'
    ),
    v_correlation_id::TEXT
  );
  
  RETURN v_result;
END;
$$;

-- Create RPC function to apply analysis from one message to another
CREATE OR REPLACE FUNCTION xdelo_apply_duplicate_content_analysis(
  p_target_message_id UUID,
  p_source_message_id UUID,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_source_content JSONB;
  v_correlation_id UUID := COALESCE(p_correlation_id::UUID, gen_random_uuid());
  v_target_old_content JSONB;
BEGIN
  -- Get the source message analyzed content
  SELECT 
    analyzed_content INTO v_source_content
  FROM 
    messages
  WHERE 
    id = p_source_message_id;
  
  IF v_source_content IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'message', 'Source message has no analyzed content',
      'source_message_id', p_source_message_id,
      'target_message_id', p_target_message_id
    );
  END IF;
  
  -- Get current analyzed content of target (if any)
  SELECT 
    analyzed_content INTO v_target_old_content
  FROM 
    messages
  WHERE 
    id = p_target_message_id;
  
  -- Apply the content to the target message
  UPDATE messages
  SET 
    is_duplicate_content = TRUE,
    duplicate_of_message_id = p_source_message_id,
    analyzed_content = v_source_content,
    old_analyzed_content = CASE 
      WHEN v_target_old_content IS NOT NULL THEN 
        COALESCE(old_analyzed_content, ARRAY[]::jsonb[]) || v_target_old_content
      ELSE 
        old_analyzed_content
      END,
    processing_state = 'completed',
    processing_completed_at = CURRENT_TIMESTAMP
  WHERE 
    id = p_target_message_id
  RETURNING 
    jsonb_build_object(
      'success', TRUE,
      'message', 'Analysis applied successfully',
      'source_message_id', p_source_message_id,
      'target_message_id', p_target_message_id,
      'is_duplicate_content', TRUE
    ) INTO v_result;
  
  -- Log this operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    correlation_id
  ) VALUES (
    'duplicate_content_applied',
    p_target_message_id,
    jsonb_build_object(
      'source_message_id', p_source_message_id,
      'target_message_id', p_target_message_id
    ),
    v_correlation_id::TEXT
  );
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'success', FALSE,
    'message', 'Target message not found',
    'source_message_id', p_source_message_id,
    'target_message_id', p_target_message_id
  ));
END;
$$; 