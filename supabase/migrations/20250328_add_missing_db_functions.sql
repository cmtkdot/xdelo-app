
-- Add missing RPC functions that the UI is trying to use

-- Reset stalled messages function (if it doesn't already exist)
CREATE OR REPLACE FUNCTION public.xdelo_reset_stalled_messages()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_reset_count integer := 0;
BEGIN
  -- Reset messages stuck in processing state for more than 15 minutes
  UPDATE messages
  SET processing_state = 'pending',
      error_message = 'Reset from stalled processing',
      updated_at = NOW()
  WHERE processing_state = 'processing'
    AND processing_started_at < NOW() - interval '15 minutes'
  RETURNING COUNT(*) INTO v_reset_count;

  -- Log the reset operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  ) VALUES (
    'stalled_messages_reset',
    'system',
    jsonb_build_object(
      'count', v_reset_count,
      'timestamp', NOW()
    )
  );

  RETURN json_build_object(
    'reset_count', v_reset_count,
    'timestamp', NOW()
  );
END;
$function$;

-- Fix MIME types function (if it doesn't already exist)
CREATE OR REPLACE FUNCTION public.xdelo_fix_mime_types(p_message_id uuid DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated_count integer := 0;
  v_query text;
  v_where_clause text := '';
BEGIN
  -- Build the WHERE clause based on whether a specific message ID was provided
  IF p_message_id IS NOT NULL THEN
    v_where_clause := 'WHERE id = ''' || p_message_id || '''::uuid';
  ELSE
    v_where_clause := 'WHERE mime_type IS NULL OR mime_type = '''' OR mime_type_verified IS NOT TRUE';
  END IF;
  
  -- Build and execute the dynamic query to update MIME types
  v_query := '
    UPDATE messages
    SET 
      mime_type = CASE
        WHEN storage_path ILIKE ''%.jpg'' OR storage_path ILIKE ''%.jpeg'' THEN ''image/jpeg''
        WHEN storage_path ILIKE ''%.png'' THEN ''image/png''
        WHEN storage_path ILIKE ''%.gif'' THEN ''image/gif''
        WHEN storage_path ILIKE ''%.webp'' THEN ''image/webp''
        WHEN storage_path ILIKE ''%.mp4'' THEN ''video/mp4''
        WHEN storage_path ILIKE ''%.mov'' THEN ''video/quicktime''
        WHEN storage_path ILIKE ''%.pdf'' THEN ''application/pdf''
        WHEN storage_path ILIKE ''%.doc'' OR storage_path ILIKE ''%.docx'' THEN ''application/msword''
        WHEN storage_path ILIKE ''%.xls'' OR storage_path ILIKE ''%.xlsx'' THEN ''application/vnd.ms-excel''
        WHEN storage_path ILIKE ''%.zip'' THEN ''application/zip''
        ELSE mime_type
      END,
      mime_type_verified = TRUE,
      content_disposition = ''inline'',
      updated_at = NOW()
    ' || v_where_clause;
    
  EXECUTE v_query;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the update operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  ) VALUES (
    'mime_types_fixed',
    'system',
    jsonb_build_object(
      'message_id', p_message_id,
      'count', v_updated_count,
      'timestamp', NOW()
    )
  );
  
  RETURN json_build_object(
    'updated_count', v_updated_count,
    'timestamp', NOW()
  );
END;
$function$;

-- Fix storage paths function (if it doesn't already exist)
CREATE OR REPLACE FUNCTION public.xdelo_fix_storage_paths(p_message_ids uuid[] DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated_count integer := 0;
  v_query text;
  v_where_clause text := '';
BEGIN
  -- Build the WHERE clause based on whether specific message IDs were provided
  IF p_message_ids IS NOT NULL AND array_length(p_message_ids, 1) > 0 THEN
    v_where_clause := 'WHERE id = ANY(''' || p_message_ids::text || '''::uuid[])';
  ELSE
    v_where_clause := 'WHERE storage_path_standardized IS NOT TRUE AND storage_path IS NOT NULL';
  END IF;
  
  -- Build and execute the dynamic query to standardize storage paths
  v_query := '
    UPDATE messages
    SET 
      storage_path = CASE
        -- Remove any double slashes
        WHEN storage_path LIKE ''%//%'' THEN replace(storage_path, ''/'', ''/'')
        -- Ensure telegram-media/ prefix is present
        WHEN storage_path NOT LIKE ''telegram-media/%'' THEN ''telegram-media/'' || storage_path
        ELSE storage_path
      END,
      storage_path_standardized = TRUE,
      public_url = ''https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/'' || 
        CASE
          WHEN storage_path NOT LIKE ''telegram-media/%'' THEN ''telegram-media/'' || storage_path
          ELSE storage_path
        END,
      updated_at = NOW()
    ' || v_where_clause;
    
  EXECUTE v_query;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the update operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  ) VALUES (
    'storage_paths_fixed',
    'system',
    jsonb_build_object(
      'message_ids', p_message_ids,
      'count', v_updated_count,
      'timestamp', NOW()
    )
  );
  
  RETURN json_build_object(
    'updated_count', v_updated_count,
    'timestamp', NOW()
  );
END;
$function$;

-- Make sure the function accepts arrays of message IDs
CREATE OR REPLACE FUNCTION public.xdelo_fix_mime_types(p_message_ids uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated_count integer := 0;
  v_query text;
BEGIN
  -- Build and execute the dynamic query to update MIME types for an array of messages
  v_query := '
    UPDATE messages
    SET 
      mime_type = CASE
        WHEN storage_path ILIKE ''%.jpg'' OR storage_path ILIKE ''%.jpeg'' THEN ''image/jpeg''
        WHEN storage_path ILIKE ''%.png'' THEN ''image/png''
        WHEN storage_path ILIKE ''%.gif'' THEN ''image/gif''
        WHEN storage_path ILIKE ''%.webp'' THEN ''image/webp''
        WHEN storage_path ILIKE ''%.mp4'' THEN ''video/mp4''
        WHEN storage_path ILIKE ''%.mov'' THEN ''video/quicktime''
        WHEN storage_path ILIKE ''%.pdf'' THEN ''application/pdf''
        WHEN storage_path ILIKE ''%.doc'' OR storage_path ILIKE ''%.docx'' THEN ''application/msword''
        WHEN storage_path ILIKE ''%.xls'' OR storage_path ILIKE ''%.xlsx'' THEN ''application/vnd.ms-excel''
        WHEN storage_path ILIKE ''%.zip'' THEN ''application/zip''
        ELSE mime_type
      END,
      mime_type_verified = TRUE,
      content_disposition = ''inline'',
      updated_at = NOW()
    WHERE id = ANY($1)';
    
  EXECUTE v_query USING p_message_ids;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  -- Log the update operation
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    metadata
  ) VALUES (
    'mime_types_fixed',
    'system',
    jsonb_build_object(
      'message_ids_count', array_length(p_message_ids, 1),
      'updated_count', v_updated_count,
      'timestamp', NOW()
    )
  );
  
  RETURN json_build_object(
    'updated_count', v_updated_count,
    'timestamp', NOW()
  );
END;
$function$;
