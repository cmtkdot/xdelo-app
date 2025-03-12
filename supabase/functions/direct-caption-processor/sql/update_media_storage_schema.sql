
-- Add columns for improved media storage tracking
DO $$
BEGIN
    -- Track if this is a duplicate file
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'is_duplicate') THEN
        ALTER TABLE public.messages ADD COLUMN is_duplicate BOOLEAN DEFAULT FALSE;
    END IF;

    -- Reference to the original message with this file
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'duplicate_reference_id') THEN
        ALTER TABLE public.messages ADD COLUMN duplicate_reference_id UUID;
    END IF;

    -- Track if storage file actually exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'storage_exists') THEN
        ALTER TABLE public.messages ADD COLUMN storage_exists BOOLEAN DEFAULT FALSE;
    END IF;

    -- Original MIME type from Telegram
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'mime_type_original') THEN
        ALTER TABLE public.messages ADD COLUMN mime_type_original TEXT;
    END IF;

    -- Track if storage path has been standardized
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'storage_path_standardized') THEN
        ALTER TABLE public.messages ADD COLUMN storage_path_standardized BOOLEAN DEFAULT FALSE;
    END IF;

    -- Create an index on file_unique_id for faster lookups if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE schemaname = 'public' 
                  AND tablename = 'messages' 
                  AND indexname = 'idx_messages_file_unique_id') THEN
        CREATE INDEX idx_messages_file_unique_id ON public.messages(file_unique_id);
    END IF;

    RAISE NOTICE 'Messages table schema has been updated with media storage columns';
END $$;

-- Create or replace the simplified storage path function
CREATE OR REPLACE FUNCTION xdelo_standardize_storage_path(
  p_file_unique_id TEXT,
  p_mime_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_extension TEXT;
BEGIN
  -- Get extension from MIME type
  CASE
    WHEN p_mime_type = 'image/jpeg' THEN v_extension := 'jpg';
    WHEN p_mime_type = 'image/png' THEN v_extension := 'png';
    WHEN p_mime_type = 'image/gif' THEN v_extension := 'gif';
    WHEN p_mime_type = 'image/webp' THEN v_extension := 'webp';
    WHEN p_mime_type = 'video/mp4' THEN v_extension := 'mp4';
    WHEN p_mime_type = 'video/webm' THEN v_extension := 'webm';
    WHEN p_mime_type = 'audio/mpeg' THEN v_extension := 'mp3';
    WHEN p_mime_type = 'audio/ogg' THEN v_extension := 'ogg';
    WHEN p_mime_type = 'audio/webm' THEN v_extension := 'webm';
    WHEN p_mime_type = 'application/pdf' THEN v_extension := 'pdf';
    WHEN p_mime_type = 'application/x-tgsticker' THEN v_extension := 'tgs';
    WHEN p_mime_type = 'text/plain' THEN v_extension := 'txt';
    ELSE v_extension := SPLIT_PART(p_mime_type, '/', 2);
  END CASE;
  
  -- If extension is empty or just 'octet-stream', use 'bin' as fallback
  IF v_extension IS NULL OR v_extension = '' OR v_extension = 'octet-stream' THEN
    v_extension := 'bin';
  END IF;
  
  -- Create simplified path format: just fileUniqueId.extension
  RETURN p_file_unique_id || '.' || v_extension;
END;
$$ LANGUAGE plpgsql;

-- Create a function to verify storage paths and fix broken ones
CREATE OR REPLACE FUNCTION xdelo_fix_storage_paths(
  p_limit INTEGER DEFAULT 100,
  p_only_check BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
  message_id UUID,
  old_path TEXT,
  new_path TEXT,
  fixed BOOLEAN,
  needs_redownload BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH messages_to_fix AS (
    SELECT 
      id,
      file_unique_id,
      mime_type,
      storage_path,
      public_url,
      xdelo_standardize_storage_path(file_unique_id, mime_type) AS correct_path
    FROM 
      messages
    WHERE 
      deleted_from_telegram = FALSE
      AND file_unique_id IS NOT NULL
      AND mime_type IS NOT NULL
    ORDER BY 
      updated_at DESC
    LIMIT 
      p_limit
  ),
  updated_messages AS (
    UPDATE messages m
    SET 
      storage_path = mtf.correct_path,
      public_url = Concat(
        (SELECT value FROM app_settings WHERE key = 'SUPABASE_URL'), 
        '/storage/v1/object/public/telegram-media/', 
        mtf.correct_path
      ),
      storage_path_standardized = TRUE,
      updated_at = NOW()
    FROM 
      messages_to_fix mtf
    WHERE 
      m.id = mtf.id
      AND (mtf.storage_path != mtf.correct_path OR mtf.storage_path IS NULL)
      AND p_only_check = FALSE
    RETURNING
      m.id,
      mtf.storage_path AS old_path,
      m.storage_path AS new_path,
      TRUE AS fixed,
      CASE WHEN mtf.storage_path IS NULL THEN TRUE ELSE FALSE END AS needs_redownload
  )
  SELECT * FROM updated_messages;
END;
$$ LANGUAGE plpgsql;

-- Create a function to find valid file_id in media group
CREATE OR REPLACE FUNCTION xdelo_find_valid_file_id(
  p_media_group_id TEXT,
  p_file_unique_id TEXT
) RETURNS TEXT AS $$
DECLARE
  v_file_id TEXT;
BEGIN
  -- First try to find the exact file
  SELECT file_id INTO v_file_id
  FROM messages
  WHERE file_unique_id = p_file_unique_id
  AND file_id IS NOT NULL
  AND deleted_from_telegram = FALSE
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If found, return it
  IF v_file_id IS NOT NULL THEN
    RETURN v_file_id;
  END IF;
  
  -- Otherwise try to find any file in the same media group
  IF p_media_group_id IS NOT NULL THEN
    SELECT file_id INTO v_file_id
    FROM messages
    WHERE media_group_id = p_media_group_id
    AND file_id IS NOT NULL
    AND deleted_from_telegram = FALSE
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;
  
  RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;
