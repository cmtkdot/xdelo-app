
-- Add new fields for better file handling
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS file_id_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS original_file_id TEXT,
ADD COLUMN IF NOT EXISTS redownload_strategy TEXT,
ADD COLUMN IF NOT EXISTS redownload_attempts INT DEFAULT 0;

-- Create index for file_unique_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_file_unique_id 
ON public.messages (file_unique_id);

-- Create index for media_group_id for faster group operations
CREATE INDEX IF NOT EXISTS idx_messages_media_group_id 
ON public.messages (media_group_id);

-- Function to standardize storage path generation
CREATE OR REPLACE FUNCTION xdelo_standardize_storage_path(
  p_file_unique_id TEXT,
  p_mime_type TEXT DEFAULT 'image/jpeg'
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_extension TEXT;
BEGIN
  -- Extract extension from mime_type
  IF p_mime_type IS NOT NULL THEN
    v_extension := split_part(p_mime_type, '/', 2);
  ELSE
    v_extension := 'jpeg';
  END IF;
  
  -- Return standardized path
  RETURN p_file_unique_id || '.' || v_extension;
END;
$$;

-- Function to set a standard expiration time for file_ids (24 hours)
CREATE OR REPLACE FUNCTION xdelo_set_file_id_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expiration if file_id exists and expiration isn't already set
  IF NEW.file_id IS NOT NULL AND NEW.file_id_expires_at IS NULL THEN
    NEW.file_id_expires_at := NOW() + INTERVAL '24 hours';
  END IF;
  
  -- Keep track of original file_id if it changes
  IF (TG_OP = 'UPDATE' AND OLD.file_id != NEW.file_id AND NEW.file_id IS NOT NULL) THEN
    NEW.original_file_id := COALESCE(OLD.original_file_id, OLD.file_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for file_id expiration
CREATE TRIGGER trg_set_file_id_expiration
BEFORE INSERT OR UPDATE OF file_id ON public.messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_set_file_id_expiration();

-- Function to find valid file_ids in a media group
CREATE OR REPLACE FUNCTION xdelo_find_valid_file_id(
  p_media_group_id TEXT,
  p_file_unique_id TEXT
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_file_id TEXT;
BEGIN
  -- Find a valid file_id from the same media group and file_unique_id
  SELECT file_id INTO v_file_id
  FROM messages
  WHERE media_group_id = p_media_group_id
    AND file_unique_id = p_file_unique_id
    AND (file_id_expires_at IS NULL OR file_id_expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN v_file_id;
END;
$$;

-- Function to mark files for redownload with appropriate strategy
CREATE OR REPLACE FUNCTION xdelo_mark_for_redownload(
  p_message_id UUID,
  p_reason TEXT DEFAULT 'File missing or corrupted'
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_message messages;
  v_strategy TEXT;
BEGIN
  -- Get the message
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Determine the best redownload strategy
  IF v_message.media_group_id IS NOT NULL THEN
    v_strategy := 'media_group';
  ELSIF v_message.file_id IS NOT NULL AND 
        (v_message.file_id_expires_at IS NULL OR v_message.file_id_expires_at > NOW()) THEN
    v_strategy := 'telegram_api';
  ELSE
    v_strategy := 'manual';
  END IF;
  
  -- Update the message
  UPDATE messages
  SET needs_redownload = TRUE,
      redownload_reason = p_reason,
      redownload_flagged_at = NOW(),
      redownload_strategy = v_strategy
  WHERE id = p_message_id;
  
  RETURN TRUE;
END;
$$;

-- Update existing records with standardized storage paths
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT id, file_unique_id, mime_type, storage_path
    FROM messages
    WHERE file_unique_id IS NOT NULL
      AND (storage_path IS NULL OR storage_path = '' OR storage_path NOT LIKE (file_unique_id || '%'))
  LOOP
    UPDATE messages
    SET storage_path = xdelo_standardize_storage_path(r.file_unique_id, r.mime_type),
        needs_redownload = TRUE,
        redownload_reason = 'Storage path standardization',
        redownload_strategy = 'telegram_api',
        redownload_flagged_at = NOW()
    WHERE id = r.id;
  END LOOP;
END $$;
