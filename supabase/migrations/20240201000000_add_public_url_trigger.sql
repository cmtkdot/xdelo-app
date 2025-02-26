
-- Add trigger for constructing public_url when analyzed_content is set
CREATE OR REPLACE FUNCTION xdelo_construct_public_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.analyzed_content IS NOT NULL THEN
    -- Construct public URL from storage path
    NEW.public_url := CASE 
      WHEN NEW.storage_path IS NOT NULL THEN
        (SELECT storage.storage_public_url(bucket_id, NEW.storage_path)
         FROM storage.buckets 
         WHERE name = 'telegram-media' 
         LIMIT 1)
      ELSE NULL
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER xdelo_trg_construct_public_url
  BEFORE UPDATE OF analyzed_content ON messages
  FOR EACH ROW
  EXECUTE FUNCTION xdelo_construct_public_url();
