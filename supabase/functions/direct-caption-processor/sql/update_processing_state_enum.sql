
-- Simplify the processing_state enum by removing unnecessary states
DO $$
BEGIN
  -- First update any messages using alternative states to standard ones
  UPDATE public.messages 
  SET processing_state = 'completed'
  WHERE processing_state = 'partial_success';
  
  -- Update the enum type
  ALTER TYPE processing_state RENAME TO processing_state_old;
  CREATE TYPE processing_state AS ENUM ('pending', 'processing', 'completed', 'error');
  
  -- Update the messages table to use the new enum
  ALTER TABLE public.messages 
  ALTER COLUMN processing_state TYPE processing_state 
  USING processing_state::text::processing_state;
  
  -- Drop the old enum
  DROP TYPE processing_state_old;
  
  -- Remove unnecessary processing-related columns
  ALTER TABLE public.messages 
  DROP COLUMN IF EXISTS processing_correlation_id,
  DROP COLUMN IF EXISTS sync_attempt,
  DROP COLUMN IF EXISTS processing_attempts,
  DROP COLUMN IF EXISTS last_processing_attempt;
END
$$;
