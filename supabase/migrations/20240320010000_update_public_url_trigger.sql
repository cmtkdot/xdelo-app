
CREATE OR REPLACE FUNCTION public.xdelo_construct_public_url()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if file_unique_id exists
  IF NEW.file_unique_id IS NOT NULL THEN
    -- Extract extension from mime_type
    NEW.public_url := CASE 
      WHEN NEW.mime_type IS NOT NULL THEN
        'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || 
        NEW.file_unique_id || '.' || 
        (SELECT split_part(NEW.mime_type, '/', 2))  -- Get the extension part of mime_type
      ELSE
        -- Fallback to jpeg if no mime_type
        'https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/' || 
        NEW.file_unique_id || '.jpeg'
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger if it exists
DROP TRIGGER IF EXISTS xdelo_trg_construct_public_url ON messages;

CREATE TRIGGER xdelo_trg_construct_public_url
  BEFORE INSERT OR UPDATE OF file_unique_id, mime_type ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_construct_public_url();
