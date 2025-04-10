-- Migration to standardize forward message handling across both media and text messages
-- This ensures a consistent approach for handling forwarded messages in the database

-- First, change the is_forward column type from TEXT to BOOLEAN for proper typing
ALTER TABLE public.other_messages 
  ALTER COLUMN is_forward TYPE BOOLEAN USING 
    CASE 
      WHEN is_forward = 'true' THEN TRUE 
      WHEN is_forward = 'TRUE' THEN TRUE
      WHEN is_forward = '1' THEN TRUE
      WHEN is_forward = 't' THEN TRUE
      ELSE FALSE 
    END;

-- Add comments to clarify the purpose of forward-related columns
COMMENT ON COLUMN public.other_messages.is_forward IS 'Flag indicating if message is forwarded';
COMMENT ON COLUMN public.other_messages.forward_info IS 'Structured JSON with details about the original message that was forwarded';

-- Create an index to speed up queries for forwarded messages
CREATE INDEX IF NOT EXISTS idx_other_messages_is_forward 
  ON public.other_messages (is_forward) 
  WHERE is_forward = TRUE;

-- Function to check for valid forward_info structure
CREATE OR REPLACE FUNCTION public.validate_forward_info(forward_info jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Basic structure validation
  IF forward_info IS NULL THEN
    RETURN TRUE; -- NULL is valid (not a forwarded message)
  END IF;
  
  -- Check for required field 'date'
  IF NOT forward_info ? 'date' THEN
    RETURN FALSE;
  END IF;
  
  -- All checks passed
  RETURN TRUE;
END;
$function$;

-- Add constraint to enforce valid forward_info structure
ALTER TABLE public.other_messages 
  ADD CONSTRAINT check_valid_forward_info 
  CHECK (validate_forward_info(forward_info));

-- Create a migration log entry
INSERT INTO public.unified_audit_logs (
  event_type,
  entity_id,
  correlation_id,
  metadata
) VALUES (
  'schema_migration',
  gen_random_uuid(),
  'system',
  jsonb_build_object(
    'migration_name', '20250409_standardize_forward_info',
    'description', 'Standardized forward message handling',
    'changelog', jsonb_build_array(
      'Changed is_forward column from TEXT to BOOLEAN',
      'Added constraint to validate forward_info structure',
      'Added index for faster queries on forwarded messages',
      'Added helpful column comments'
    )
  )
);
