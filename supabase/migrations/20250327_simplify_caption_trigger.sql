-- Migration to simplify the caption processing trigger and clean up related/conflicting functions/triggers

-- 1. Create the new trigger function to set state to 'pending'
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

  -- Preserve old analyzed content if caption is being updated on an already processed message
  IF TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL THEN
      NEW.old_analyzed_content = OLD.analyzed_content;
      NEW.is_edited = TRUE;
  END IF;

  RETURN NEW; -- Return NEW because this is a BEFORE trigger
END;
$function$;

-- 2. Drop the old caption processing trigger if it exists (might be AFTER or BEFORE)
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;

-- 3. Create the new caption processing trigger to run BEFORE insert/update and use the new function
CREATE TRIGGER trg_process_caption
BEFORE INSERT OR UPDATE OF caption ON public.messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.caption != '') -- Condition ensures only messages with captions trigger this
EXECUTE FUNCTION public.xdelo_set_caption_pending_trigger();

-- 4. Drop the old trigger function (no longer called by trg_process_caption)
DROP FUNCTION IF EXISTS public.xdelo_process_caption_trigger();

-- 5. Drop the old workflow function (no longer called by trigger)
DROP FUNCTION IF EXISTS public.xdelo_process_caption_workflow(uuid, text, boolean);
-- Also drop the compatibility overload if it exists from 20250327_fix_caption_workflow.sql
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content(text, uuid, text);
-- Drop the check function as well, as its logic will move to the edge function
DROP FUNCTION IF EXISTS public.xdelo_check_media_group_content(text, uuid, text);

-- 6. Drop the conflicting media group check trigger and function
DROP TRIGGER IF EXISTS trg_check_media_group_on_message_change ON public.messages;
DROP FUNCTION IF EXISTS public.check_media_group_on_message_change();

-- Optional: Consider dropping other potentially redundant triggers after careful review
-- DROP TRIGGER IF EXISTS trg_validate_media_group_sync ON public.messages;
-- DROP FUNCTION IF EXISTS public.xdelo_validate_media_group_sync();
-- DROP TRIGGER IF EXISTS xdelo_trg_extract_analyzed_content ON public.messages;
-- DROP FUNCTION IF EXISTS public.xdelo_extract_analyzed_content();
