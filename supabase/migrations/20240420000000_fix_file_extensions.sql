
-- Migration to fix file extension handling
-- Run with: supabase db push

-- Function to standardize file extensions based on MIME types
CREATE OR REPLACE FUNCTION public.xdelo_standardize_file_extension(p_mime_type text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_extension text;
BEGIN
  -- Map MIME types to standard extensions
  CASE 
    WHEN p_mime_type LIKE 'image/jpeg' OR p_mime_type LIKE 'image/jpg' THEN
      v_extension := 'jpg';
    WHEN p_mime_type LIKE 'image/png' THEN
      v_extension := 'png';
    WHEN p_mime_type LIKE 'image/gif' THEN
      v_extension := 'gif';
    WHEN p_mime_type LIKE 'image/webp' THEN
      v_extension := 'webp';
    WHEN p_mime_type LIKE 'image/svg+xml' THEN
      v_extension := 'svg';
    WHEN p_mime_type LIKE 'video/mp4' THEN
      v_extension := 'mp4';
    WHEN p_mime_type LIKE 'video/quicktime' THEN
      v_extension := 'mov';
    WHEN p_mime_type LIKE 'video/x-matroska' THEN
      v_extension := 'mkv';
    WHEN p_mime_type LIKE 'video/webm' THEN
      v_extension := 'webm';
    WHEN p_mime_type LIKE 'audio/mpeg' THEN
      v_extension := 'mp3';
    WHEN p_mime_type LIKE 'audio/wav' THEN
      v_extension := 'wav';
    WHEN p_mime_type LIKE 'audio/ogg' THEN
      v_extension := 'ogg';
    WHEN p_mime_type LIKE 'application/pdf' THEN
      v_extension := 'pdf';
    WHEN p_mime_type LIKE 'application/msword' THEN
      v_extension := 'doc';
    WHEN p_mime_type LIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN
      v_extension := 'docx';
    WHEN p_mime_type LIKE 'application/vnd.ms-excel' THEN
      v_extension := 'xls';
    WHEN p_mime_type LIKE 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN
      v_extension := 'xlsx';
    WHEN p_mime_type LIKE 'text/plain' THEN
      v_extension := 'txt';
    WHEN p_mime_type LIKE 'application/zip' THEN
      v_extension := 'zip';
    WHEN p_mime_type LIKE 'application/x-tgsticker' THEN
      v_extension := 'tgs';
    ELSE
      -- Extract the subtype from MIME type (part after /)
      BEGIN
        v_extension := split_part(p_mime_type, '/', 2);
        -- Remove parameters if any (e.g., ";charset=utf-8")
        v_extension := split_part(v_extension, ';', 1);
        -- If extension is empty or same as full mime type, default to bin
        IF v_extension = '' OR v_extension = p_mime_type THEN
          v_extension := 'bin';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_extension := 'bin';
      END;
  END CASE;
  
  RETURN v_extension;
END;
$$;

-- Update the xdelo_standardize_storage_path function to use the new extension function
CREATE OR REPLACE FUNCTION public.xdelo_standardize_storage_path(p_file_unique_id text, p_mime_type text DEFAULT 'image/jpeg'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_extension text;
  v_storage_path text;
BEGIN
  -- Use the standardize file extension function
  v_extension := public.xdelo_standardize_file_extension(p_mime_type);
  
  -- Check for existing storage path if it's an octet-stream
  IF p_mime_type = 'application/octet-stream' THEN
    BEGIN
      SELECT storage_path INTO v_storage_path
      FROM messages
      WHERE file_unique_id = p_file_unique_id
      AND storage_path IS NOT NULL
      AND storage_path != ''
      LIMIT 1;
      
      IF v_storage_path IS NOT NULL THEN
        RETURN v_storage_path;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Continue with default
    END;
  END IF;
  
  -- Return standardized storage path
  RETURN p_file_unique_id || '.' || v_extension;
END;
$$;

-- Fix the public URL construction function
CREATE OR REPLACE FUNCTION public.xdelo_construct_public_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_extension text;
  v_public_url text;
  v_app_url text;
BEGIN
  -- Get the Supabase URL from app_settings
  SELECT value INTO v_app_url FROM app_settings WHERE key = 'SUPABASE_URL';
  
  -- Default to hardcoded URL if not found
  IF v_app_url IS NULL THEN
    v_app_url := 'https://xjhhehxcxkiumnwbirel.supabase.co';
  END IF;

  -- Only proceed if file_unique_id exists
  IF NEW.file_unique_id IS NOT NULL THEN
    -- Get the extension from mime_type
    v_extension := public.xdelo_standardize_file_extension(COALESCE(NEW.mime_type, 'image/jpeg'));
    
    -- If we have a storage_path, extract extension from that
    IF NEW.storage_path IS NOT NULL AND NEW.storage_path != '' THEN
      v_extension := split_part(NEW.storage_path, '.', 2);
      -- Fallback if extension couldn't be extracted
      IF v_extension IS NULL OR v_extension = '' OR v_extension = NEW.storage_path THEN
        v_extension := public.xdelo_standardize_file_extension(COALESCE(NEW.mime_type, 'image/jpeg'));
      END IF;
    END IF;
    
    -- Construct the public URL
    NEW.public_url := v_app_url || '/storage/v1/object/public/telegram-media/' || 
                     NEW.file_unique_id || '.' || v_extension;
                     
    -- Mark as standardized
    NEW.storage_path_standardized := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a new function to ensure app_settings has SUPABASE_URL
CREATE OR REPLACE FUNCTION public.xdelo_ensure_app_settings_exists(p_supabase_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert SUPABASE_URL if it doesn't exist
  INSERT INTO app_settings (key, value, description)
  VALUES ('SUPABASE_URL', p_supabase_url, 'Supabase URL for public URL generation')
  ON CONFLICT (key)
  DO UPDATE SET value = p_supabase_url
  WHERE app_settings.key = 'SUPABASE_URL';
END;
$$;

-- Create a function to fix public URLs in the database
CREATE OR REPLACE FUNCTION public.xdelo_fix_public_urls(p_limit integer DEFAULT 100)
RETURNS TABLE(message_id uuid, old_url text, new_url text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH updated_messages AS (
    UPDATE messages
    SET 
      public_url = (
        SELECT 
          CASE WHEN a.value IS NOT NULL THEN
            a.value || '/storage/v1/object/public/telegram-media/' || storage_path
          ELSE
            'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || storage_path
          END
        FROM app_settings a
        WHERE a.key = 'SUPABASE_URL'
        LIMIT 1
      ),
      updated_at = NOW(),
      storage_path_standardized = true
    WHERE 
      storage_path IS NOT NULL 
      AND storage_path != ''
      AND (
        public_url IS NULL 
        OR public_url = ''
        OR public_url NOT LIKE '%/storage/v1/object/public/%'
        OR public_url LIKE '%.jpeg' -- Fix jpeg extension
      )
    ORDER BY created_at DESC  
    LIMIT p_limit
    RETURNING id, public_url, storage_path
  )
  SELECT 
    id, 
    'previous_url'::text, 
    public_url
  FROM updated_messages;
END;
$$;

-- Create a migration function for the app_settings table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_settings') THEN
    CREATE TABLE public.app_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Add some initial settings
    INSERT INTO public.app_settings (key, value, description)
    VALUES 
      ('SUPABASE_URL', 'https://xjhhehxcxkiumnwbirel.supabase.co', 'Supabase URL for public URL generation'),
      ('TELEGRAM_MEDIA_BUCKET', 'telegram-media', 'Bucket name for Telegram media storage');
  END IF;
END
$$;

-- Create a test function for standardized extension handling
CREATE OR REPLACE FUNCTION public.xdelo_test_file_extensions()
RETURNS TABLE(mime_type text, extension text)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.mime_type,
    public.xdelo_standardize_file_extension(m.mime_type) AS extension
  FROM (
    VALUES 
      ('image/jpeg'),
      ('image/png'),
      ('image/gif'),
      ('image/webp'),
      ('video/mp4'),
      ('video/quicktime'),
      ('audio/mpeg'),
      ('application/pdf'),
      ('application/msword'),
      ('application/octet-stream'),
      ('text/plain')
  ) AS m(mime_type);
END;
$$;
