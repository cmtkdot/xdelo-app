
-- Create a function to get media group sync status
CREATE OR REPLACE FUNCTION public.get_media_group_sync_status(p_media_group_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count INTEGER;
  v_synced_count INTEGER;
  v_unsynced_count INTEGER;
  v_incomplete_count INTEGER;
  v_original_caption_count INTEGER;
BEGIN
  -- Get total count
  SELECT COUNT(*)
  INTO v_total_count
  FROM messages
  WHERE media_group_id = p_media_group_id;
  
  -- Get synced count
  SELECT COUNT(*)
  INTO v_synced_count
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND group_caption_synced = true;
  
  -- Get unsynced count
  SELECT COUNT(*)
  INTO v_unsynced_count
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND (group_caption_synced = false OR group_caption_synced IS NULL);
  
  -- Get incomplete count
  SELECT COUNT(*)
  INTO v_incomplete_count
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND analyzed_content IS NULL;
  
  -- Get original caption count
  SELECT COUNT(*)
  INTO v_original_caption_count
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND is_original_caption = true;
  
  RETURN json_build_object(
    'total_count', v_total_count,
    'synced_count', v_synced_count,
    'unsynced_count', v_unsynced_count,
    'incomplete_count', v_incomplete_count,
    'original_caption_count', v_original_caption_count
  );
END;
$$;

-- Create a function to increment a numeric field safely
CREATE OR REPLACE FUNCTION public.increment_field(
  table_name TEXT,
  column_name TEXT,
  row_id UUID,
  increment_by INTEGER DEFAULT 1
) 
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_value INTEGER;
  v_new_value INTEGER;
  v_sql TEXT;
BEGIN
  -- Build dynamic SQL to get current value
  v_sql := format('SELECT COALESCE(%I, 0) FROM %I WHERE id = $1', column_name, table_name);
  
  -- Execute and get current value
  EXECUTE v_sql INTO v_current_value USING row_id;
  
  -- Calculate new value
  v_new_value := COALESCE(v_current_value, 0) + increment_by;
  
  -- Build update SQL
  v_sql := format('UPDATE %I SET %I = $1 WHERE id = $2', table_name, column_name);
  
  -- Execute update
  EXECUTE v_sql USING v_new_value, row_id;
  
  RETURN v_new_value;
END;
$$;

-- Create a function to synchronize media group content with proper locking
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content_with_lock(
  p_media_group_id TEXT,
  p_source_message_id UUID,
  p_correlation_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_lock_key BIGINT;
BEGIN
  -- Create a numeric key from the media group ID for advisory locking
  v_lock_key := ('x' || substring(md5(p_media_group_id), 1, 16))::bit(64)::bigint;
  
  -- Try to acquire an advisory lock
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Could not acquire lock on media group, another sync operation is in progress',
      'media_group_id', p_media_group_id
    );
  END IF;
  
  -- Call the existing function within the transaction
  v_result := xdelo_sync_media_group_content(
    p_source_message_id,
    p_media_group_id,
    p_correlation_id,
    TRUE,  -- force_sync
    TRUE   -- sync_edit_history
  );
  
  RETURN v_result;
END;
$$;
