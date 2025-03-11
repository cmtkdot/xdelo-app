
-- Function to clear all messages
CREATE OR REPLACE FUNCTION public.xdelo_clear_all_messages() 
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
  start_time TIMESTAMP := clock_timestamp();
  result_json json;
BEGIN
  -- Delete from dependent tables first
  DELETE FROM public.deleted_messages;
  DELETE FROM public.unified_audit_logs WHERE entity_id IN (SELECT id FROM public.messages);
  DELETE FROM public.storage_validations;
  DELETE FROM public.sync_matches;
  
  -- Count and delete all messages
  WITH deleted AS (
    DELETE FROM public.messages
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Log this operation
  INSERT INTO public.gl_sync_logs (
    operation,
    status,
    record_id,
    table_name,
    metadata
  ) VALUES (
    'clear_all_messages',
    'success',
    'system',
    'messages',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'duration_ms', extract(epoch from (clock_timestamp() - start_time)) * 1000
    )
  );
  
  -- Build result
  result_json := json_build_object(
    'success', true,
    'deleted_count', deleted_count,
    'duration_ms', extract(epoch from (clock_timestamp() - start_time)) * 1000
  );
  
  RETURN result_json;
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO public.gl_sync_logs (
    operation,
    status,
    record_id,
    table_name,
    error_message
  ) VALUES (
    'clear_all_messages',
    'error',
    'system',
    'messages',
    SQLERRM
  );
  
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.xdelo_clear_all_messages() TO authenticated;
