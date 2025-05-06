-- Create table for storage deletion retries
CREATE TABLE IF NOT EXISTS storage_deletion_retries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ NOT NULL,
  last_retry_at TIMESTAMPTZ,
  last_error TEXT,
  correlation_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on storage path for quick lookups
CREATE INDEX IF NOT EXISTS idx_storage_deletion_retries_storage_path ON storage_deletion_retries(storage_path);

-- Create index on status and next_retry_at for efficient querying of pending retries
CREATE INDEX IF NOT EXISTS idx_storage_deletion_retries_status_next_retry ON storage_deletion_retries(status, next_retry_at);

-- Function to process pending storage deletion retries
CREATE OR REPLACE FUNCTION process_storage_deletion_retries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  retries_processed INTEGER := 0;
  retry_record RECORD;
BEGIN
  -- Get all pending retries that are due
  FOR retry_record IN
    SELECT *
    FROM storage_deletion_retries
    WHERE status = 'pending'
    AND next_retry_at <= NOW()
    AND retry_count < max_retries
    ORDER BY next_retry_at
    LIMIT 10
  LOOP
    -- Update the retry record
    UPDATE storage_deletion_retries
    SET
      status = 'processing',
      last_retry_at = NOW(),
      updated_at = NOW()
    WHERE id = retry_record.id;

    -- Call the edge function to perform the deletion
    BEGIN
      -- Use the http extension to call our edge function
      PERFORM net.http_post(
        url := (SELECT COALESCE(current_setting('app.supabase_url', true), '') || '/functions/v1/cleanup-storage-on-delete'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(current_setting('app.supabase_anon_key', true), '')
        ),
        body := jsonb_build_object(
          'storage_path', retry_record.storage_path,
          'retry_count', retry_record.retry_count + 1,
          'correlation_id', retry_record.correlation_id
        )::text
      );

      -- Update the retry record to indicate success
      UPDATE storage_deletion_retries
      SET
        status = 'success',
        retry_count = retry_count + 1,
        updated_at = NOW()
      WHERE id = retry_record.id;

    EXCEPTION WHEN OTHERS THEN
      -- Handle error - update to retry again later with exponential backoff
      UPDATE storage_deletion_retries
      SET
        status = 'pending',
        retry_count = retry_count + 1,
        next_retry_at = NOW() + (INTERVAL '1 minute' * (2 ^ retry_count)), -- Exponential backoff
        last_error = SQLERRM,
        updated_at = NOW()
      WHERE id = retry_record.id;
    END;

    retries_processed := retries_processed + 1;
  END LOOP;

  RETURN retries_processed;
END;
$$;

-- Add a cron job to process retries every 5 minutes
SELECT cron.schedule(
  'process-storage-deletion-retries',
  '*/5 * * * *',
  $$SELECT process_storage_deletion_retries()$$
);

-- Add RLS policies to the table
ALTER TABLE storage_deletion_retries ENABLE ROW LEVEL SECURITY;

-- Create a policy for admins to see all records
CREATE POLICY "Admins can see all storage deletion retries" ON storage_deletion_retries
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ));

-- Create policy for admins to update and delete all records
CREATE POLICY "Admins can update and delete storage deletion retries" ON storage_deletion_retries
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  ));
