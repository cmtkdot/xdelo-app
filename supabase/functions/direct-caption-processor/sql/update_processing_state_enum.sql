
-- Update the processing_state enum type to remove 'partial_success'
DO $$
BEGIN
  -- Check if the enum exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_state') THEN
    -- Check if it contains 'partial_success'
    IF EXISTS (
      SELECT 1 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'processing_state') 
      AND enumlabel = 'partial_success'
    ) THEN
      -- Create a new enum without 'partial_success'
      CREATE TYPE processing_state_new AS ENUM (
        'initialized',
        'pending',
        'processing',
        'completed',
        'error'
      );

      -- Update tables using the enum
      ALTER TABLE messages
        ALTER COLUMN processing_state TYPE processing_state_new
        USING (
          CASE
            WHEN processing_state::text = 'partial_success' THEN 'completed'::processing_state_new
            ELSE processing_state::text::processing_state_new
          END
        );

      -- Drop the old enum and rename the new one
      DROP TYPE processing_state;
      ALTER TYPE processing_state_new RENAME TO processing_state;
      
      RAISE NOTICE 'Successfully updated processing_state enum';
    ELSE
      RAISE NOTICE 'processing_state enum does not contain partial_success, no change needed';
    END IF;
  ELSE
    RAISE NOTICE 'processing_state enum does not exist';
  END IF;
END $$;

-- Create the message processing stats function
CREATE OR REPLACE FUNCTION xdelo_get_message_processing_stats()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_messages', COUNT(*),
    'by_state', jsonb_build_object(
      'initialized', SUM(CASE WHEN processing_state = 'initialized' THEN 1 ELSE 0 END),
      'pending', SUM(CASE WHEN processing_state = 'pending' THEN 1 ELSE 0 END),
      'processing', SUM(CASE WHEN processing_state = 'processing' THEN 1 ELSE 0 END),
      'completed', SUM(CASE WHEN processing_state = 'completed' THEN 1 ELSE 0 END),
      'error', SUM(CASE WHEN processing_state = 'error' THEN 1 ELSE 0 END)
    ),
    'with_analyzed_content', SUM(CASE WHEN analyzed_content IS NOT NULL THEN 1 ELSE 0 END),
    'with_caption', SUM(CASE WHEN caption IS NOT NULL AND caption != '' THEN 1 ELSE 0 END),
    'needs_redownload', SUM(CASE WHEN needs_redownload = true THEN 1 ELSE 0 END),
    'with_media_group_id', SUM(CASE WHEN media_group_id IS NOT NULL THEN 1 ELSE 0 END),
    'stalled_processing', SUM(CASE WHEN processing_state = 'processing' AND processing_started_at < NOW() - INTERVAL '30 minutes' THEN 1 ELSE 0 END)
  ) INTO result
  FROM messages;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Ensure the column exists
DO $$
BEGIN
  BEGIN
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS needs_redownload BOOLEAN DEFAULT FALSE;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Column needs_redownload already exists or another issue occurred: %', SQLERRM;
  END;
END $$;

-- Create a function to reset stalled messages
CREATE OR REPLACE FUNCTION xdelo_reset_stalled_processing()
RETURNS jsonb AS $$
DECLARE
  reset_count INTEGER;
  result jsonb;
BEGIN
  WITH updated_rows AS (
    UPDATE messages
    SET processing_state = 'error',
        error_message = 'Reset due to stalled processing',
        updated_at = NOW()
    WHERE processing_state = 'processing'
    AND processing_started_at < NOW() - INTERVAL '30 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO reset_count FROM updated_rows;
  
  SELECT jsonb_build_object(
    'reset_count', reset_count,
    'success', TRUE,
    'timestamp', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
