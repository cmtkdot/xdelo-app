
-- Create the function to clear all messages and related data
CREATE OR REPLACE FUNCTION xdelo_clear_all_messages()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_messages INT;
  deleted_other_messages INT;
  deleted_logs INT;
  result_json json;
BEGIN
  -- Delete all media messages
  WITH deleted AS (
    DELETE FROM messages
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_messages FROM deleted;
  
  -- Delete all other messages
  WITH deleted AS (
    DELETE FROM other_messages
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_other_messages FROM deleted;
  
  -- Record the operation in audit logs
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    correlation_id
  ) VALUES (
    'database_cleared',
    'system',
    jsonb_build_object(
      'deleted_messages', deleted_messages,
      'deleted_other_messages', deleted_other_messages,
      'operation', 'clear_all_messages',
      'timestamp', now()
    ),
    'clear_all_' || gen_random_uuid()
  );
  
  -- Return the result as JSON
  result_json := jsonb_build_object(
    'deleted_messages', deleted_messages,
    'deleted_other_messages', deleted_other_messages,
    'timestamp', now()
  );
  
  RETURN result_json;
END;
$$;
