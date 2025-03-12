
-- Add columns for MIME type tracking and correction
DO $$
BEGIN
    -- Add mime_type_original column to track original MIME type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'mime_type_original') THEN
        ALTER TABLE public.messages ADD COLUMN mime_type_original TEXT;
    END IF;

    -- Add mime_type_corrected column to track if MIME type was corrected
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'mime_type_corrected') THEN
        ALTER TABLE public.messages ADD COLUMN mime_type_corrected BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add mime_type_updated_at column to track when MIME type was last updated
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'mime_type_updated_at') THEN
        ALTER TABLE public.messages ADD COLUMN mime_type_updated_at TIMESTAMPTZ;
    END IF;

    -- Add content_disposition column to track content disposition setting
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'content_disposition') THEN
        ALTER TABLE public.messages ADD COLUMN content_disposition TEXT;
    END IF;

    -- Add storage_path_standardized column to track if storage path is standardized
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'messages' 
                  AND column_name = 'storage_path_standardized') THEN
        ALTER TABLE public.messages ADD COLUMN storage_path_standardized BOOLEAN DEFAULT FALSE;
    END IF;

    -- Create an index on file_unique_id for faster lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE schemaname = 'public' 
                  AND tablename = 'messages' 
                  AND indexname = 'idx_messages_file_unique_id') THEN
        CREATE INDEX idx_messages_file_unique_id ON public.messages(file_unique_id);
    END IF;

    -- Create an index on mime_type for faster MIME type filtering
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                  WHERE schemaname = 'public' 
                  AND tablename = 'messages' 
                  AND indexname = 'idx_messages_mime_type') THEN
        CREATE INDEX idx_messages_mime_type ON public.messages(mime_type);
    END IF;

    RAISE NOTICE 'Messages table schema has been updated with MIME type tracking columns';
END $$;

-- Create a function to standardize storage paths
CREATE OR REPLACE FUNCTION xdelo_standardize_storage_path(
  p_file_unique_id TEXT,
  p_mime_type TEXT
) RETURNS TEXT AS $$
DECLARE
  v_extension TEXT;
  v_year TEXT;
  v_month TEXT;
  v_path TEXT;
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
  
  -- Create year/month folders for better organization
  v_year := EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::TEXT;
  v_month := LPAD(EXTRACT(MONTH FROM CURRENT_TIMESTAMP)::TEXT, 2, '0');
  
  -- Create path
  v_path := v_year || '/' || v_month || '/' || p_file_unique_id || '.' || v_extension;
  
  RETURN v_path;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get a more accurate MIME type
CREATE OR REPLACE FUNCTION xdelo_get_accurate_mime_type(p_message_data JSONB) RETURNS TEXT AS $$
DECLARE
  v_mime_type TEXT;
BEGIN
  -- First check if mime_type already exists in message data
  v_mime_type := p_message_data->>'mime_type';
  
  -- If it's a good MIME type (not null and not octet-stream), return it
  IF v_mime_type IS NOT NULL AND v_mime_type != 'application/octet-stream' THEN
    RETURN v_mime_type;
  END IF;
  
  -- Otherwise determine from telegram_data
  IF p_message_data->'telegram_data'->'photo' IS NOT NULL THEN
    RETURN 'image/jpeg';
  ELSIF p_message_data->'telegram_data'->'video' IS NOT NULL THEN
    -- Try to get mime_type from video object
    v_mime_type := p_message_data->'telegram_data'->'video'->>'mime_type';
    RETURN COALESCE(v_mime_type, 'video/mp4');
  ELSIF p_message_data->'telegram_data'->'document' IS NOT NULL THEN
    -- Try to get mime_type from document object
    v_mime_type := p_message_data->'telegram_data'->'document'->>'mime_type';
    RETURN COALESCE(v_mime_type, 'application/octet-stream');
  ELSIF p_message_data->'telegram_data'->'audio' IS NOT NULL THEN
    v_mime_type := p_message_data->'telegram_data'->'audio'->>'mime_type';
    RETURN COALESCE(v_mime_type, 'audio/mpeg');
  ELSIF p_message_data->'telegram_data'->'voice' IS NOT NULL THEN
    v_mime_type := p_message_data->'telegram_data'->'voice'->>'mime_type';
    RETURN COALESCE(v_mime_type, 'audio/ogg');
  ELSIF p_message_data->'telegram_data'->'animation' IS NOT NULL THEN
    RETURN 'video/mp4';
  ELSIF p_message_data->'telegram_data'->'sticker' IS NOT NULL THEN
    IF (p_message_data->'telegram_data'->'sticker'->>'is_animated')::BOOLEAN THEN
      RETURN 'application/x-tgsticker';
    ELSE
      RETURN 'image/webp';
    END IF;
  END IF;
  
  -- Default fallback
  RETURN 'application/octet-stream';
END;
$$ LANGUAGE plpgsql;

-- Create a function to fix incorrect MIME types
CREATE OR REPLACE FUNCTION xdelo_fix_mime_types(
  p_limit INTEGER DEFAULT 100,
  p_only_octet_stream BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
  message_id UUID,
  original_mime_type TEXT,
  new_mime_type TEXT,
  file_unique_id TEXT,
  fixed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH messages_to_fix AS (
    SELECT 
      id,
      mime_type,
      file_unique_id,
      telegram_data,
      xdelo_get_accurate_mime_type(to_jsonb(m)) AS detected_mime_type
    FROM 
      messages m
    WHERE 
      (p_only_octet_stream = FALSE OR mime_type = 'application/octet-stream' OR mime_type IS NULL)
      AND deleted_from_telegram = FALSE
      AND file_unique_id IS NOT NULL
    ORDER BY 
      updated_at DESC
    LIMIT 
      p_limit
  ),
  updated_messages AS (
    UPDATE messages m
    SET 
      mime_type = mtf.detected_mime_type,
      mime_type_original = m.mime_type,
      mime_type_corrected = TRUE,
      mime_type_updated_at = NOW(),
      updated_at = NOW()
    FROM 
      messages_to_fix mtf
    WHERE 
      m.id = mtf.id
      AND mtf.mime_type != mtf.detected_mime_type
    RETURNING
      m.id,
      m.mime_type_original,
      m.mime_type,
      m.file_unique_id,
      TRUE as fixed
  )
  SELECT * FROM updated_messages;
END;
$$ LANGUAGE plpgsql;
