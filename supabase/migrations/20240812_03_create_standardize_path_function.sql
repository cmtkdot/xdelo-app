
-- Start transaction
BEGIN;

-- Create helper function to standardize storage paths for files
CREATE OR REPLACE FUNCTION xdelo_standardize_storage_path(
  p_file_unique_id text,
  p_mime_type text DEFAULT 'image/jpeg'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_extension text;
  v_storage_path text;
BEGIN
  -- Determine proper extension based on mime type
  CASE 
    WHEN p_mime_type LIKE 'image/jpeg' OR p_mime_type LIKE 'image/jpg' THEN
      v_extension := 'jpeg';
    WHEN p_mime_type LIKE 'image/png' THEN
      v_extension := 'png';
    WHEN p_mime_type LIKE 'image/gif' THEN
      v_extension := 'gif';
    WHEN p_mime_type LIKE 'image/webp' THEN
      v_extension := 'webp';
    WHEN p_mime_type LIKE 'video/mp4' THEN
      v_extension := 'mp4';
    WHEN p_mime_type LIKE 'video/quicktime' THEN
      v_extension := 'mov';
    WHEN p_mime_type LIKE 'application/octet-stream' THEN
      -- For octet-stream, try to infer from existing file if possible
      BEGIN
        SELECT storage_path INTO v_storage_path
        FROM messages
        WHERE file_unique_id = p_file_unique_id
        AND storage_path IS NOT NULL
        AND storage_path != ''
        LIMIT 1;
        
        IF v_storage_path IS NOT NULL THEN
          RETURN v_storage_path;
        ELSE
          v_extension := 'bin';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_extension := 'bin';
      END;
    ELSE
      -- Use the part after '/' or default to 'bin'
      BEGIN
        v_extension := split_part(p_mime_type, '/', 2);
        IF v_extension = '' OR v_extension = p_mime_type THEN
          v_extension := 'bin';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_extension := 'bin';
      END;
  END CASE;
  
  -- Return standardized storage path
  RETURN p_file_unique_id || '.' || v_extension;
END;
$$;

-- Create a function to find a valid file_id in a media group
CREATE OR REPLACE FUNCTION xdelo_find_valid_file_id(
  p_media_group_id text,
  p_file_unique_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_file_id text;
  v_current_time timestamp;
BEGIN
  v_current_time := NOW();
  
  -- First try to find a non-expired file_id for the same file_unique_id
  SELECT file_id INTO v_file_id
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND file_unique_id = p_file_unique_id
  AND file_id IS NOT NULL
  AND (file_id_expires_at IS NULL OR file_id_expires_at > v_current_time)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_file_id IS NOT NULL THEN
    RETURN v_file_id;
  END IF;
  
  -- If not found, look for any recent file_id in the media group
  SELECT file_id INTO v_file_id
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND file_id IS NOT NULL
  AND (file_id_expires_at IS NULL OR file_id_expires_at > v_current_time)
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_file_id IS NOT NULL THEN
    RETURN v_file_id;
  END IF;
  
  -- As a last resort, return any file_id even if expired
  SELECT file_id INTO v_file_id
  FROM messages
  WHERE media_group_id = p_media_group_id
  AND file_unique_id = p_file_unique_id
  AND file_id IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_file_id;
END;
$$;

-- Commit transaction
COMMIT;
