
-- Fix the caption trigger to properly prepare messages for parsing
CREATE OR REPLACE FUNCTION public.xdelo_set_caption_pending_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Set processing state to pending and record the start time
  NEW.processing_state = 'pending';
  NEW.processing_started_at = NOW();
  NEW.updated_at = NOW(); -- Ensure updated_at reflects this change
  
  -- Generate a correlation ID if none exists
  IF NEW.correlation_id IS NULL THEN
    NEW.correlation_id = gen_random_uuid()::text;
  END IF;

  -- Preserve old analyzed content if caption is being updated on an already processed message
  IF TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL THEN
      NEW.old_analyzed_content = OLD.analyzed_content;
      NEW.is_edited = TRUE;
  END IF;

  -- Ensure we have the required parameters
  IF NEW.caption IS NULL OR NEW.caption = '' THEN
    -- Don't set to pending if there's no caption
    NEW.processing_state = 'initialized';
    RETURN NEW;
  END IF;

  -- Log this event for tracking
  INSERT INTO unified_audit_logs (
    event_type,
    entity_type,
    entity_id,
    correlation_id,
    metadata
  ) VALUES (
    'caption_pending',
    'message',
    NEW.id,
    NEW.correlation_id,
    jsonb_build_object(
      'caption_length', length(NEW.caption),
      'media_group_id', NEW.media_group_id,
      'is_edit', TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL
    )
  );

  RETURN NEW; -- Return NEW because this is a BEFORE trigger
END;
$function$;

-- Make sure the trigger is properly set up for both INSERTs and UPDATEs
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;
CREATE TRIGGER trg_process_caption
BEFORE INSERT OR UPDATE OF caption ON public.messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.caption <> '')
EXECUTE FUNCTION public.xdelo_set_caption_pending_trigger();
