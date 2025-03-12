
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;

-- Create a wrapper function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.xdelo_process_caption_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Call the workflow function with the NEW record's id and correlation_id
  PERFORM public.xdelo_process_caption_workflow(NEW.id, NEW.correlation_id);
  RETURN NEW;
END;
$$;

-- Create the actual trigger that calls our wrapper function
CREATE TRIGGER trg_process_caption
  AFTER INSERT OR UPDATE OF caption
  ON public.messages
  FOR EACH ROW
  WHEN (NEW.caption IS NOT NULL AND NEW.caption != '')
  EXECUTE FUNCTION public.xdelo_process_caption_trigger();

-- Log the creation for audit purposes
INSERT INTO unified_audit_logs (
  event_type,
  metadata,
  event_timestamp
) VALUES (
  'system_configuration_updated',
  jsonb_build_object(
    'component', 'trigger',
    'name', 'trg_process_caption',
    'action', 'created',
    'details', 'Trigger for immediate caption processing'
  ),
  NOW()
);
