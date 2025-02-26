
-- Create the telegram-media storage bucket if it doesn't exist
DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('telegram-media', 'telegram-media', true)
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Update bucket public access
UPDATE storage.buckets
SET public = true
WHERE id = 'telegram-media';

-- Ensure RLS is disabled for the bucket
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
