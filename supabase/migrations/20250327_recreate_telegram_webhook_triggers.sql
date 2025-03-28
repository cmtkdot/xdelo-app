-- Migration to recreate all Telegram webhook database triggers and functions
-- This includes caption processing, media group handling, and audit logging

-- 1. First drop all existing triggers and functions to avoid conflicts
DROP TRIGGER IF EXISTS trg_process_caption ON public.messages;
DROP TRIGGER IF EXISTS trg_audit_message_changes ON public.messages;
DROP TRIGGER IF EXISTS trg_sync_media_group ON public.messages;

DROP FUNCTION IF EXISTS public.xdelo_set_caption_pending_trigger();
DROP FUNCTION IF EXISTS public.xdelo_audit_message_changes();
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_content();

-- 2. Create the caption processing trigger function
CREATE OR REPLACE FUNCTION public.xdelo_set_caption_pending_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Set processing state to pending and record the start time
  NEW.processing_state = 'pending';
  NEW.processing_started_at = NOW();
  NEW.updated_at = NOW();

  -- Preserve old analyzed content if caption is being updated
  IF TG_OP = 'UPDATE' AND OLD.analyzed_content IS NOT NULL THEN
      NEW.old_analyzed_content = OLD.analyzed_content;
      NEW.is_edited = TRUE;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Create the caption processing trigger
CREATE TRIGGER trg_process_caption
BEFORE INSERT OR UPDATE OF caption ON public.messages
FOR EACH ROW
WHEN (NEW.caption IS NOT NULL AND NEW.caption != '')
EXECUTE FUNCTION public.xdelo_set_caption_pending_trigger();

-- 4. Create media group sync function
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
  p_message_id uuid,
  p_analyzed_content jsonb,
  p_force_sync boolean DEFAULT false,
  p_sync_edit_history boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_media_group_id text;
  v_group_count integer;
BEGIN
  -- Get the media group ID for this message
  SELECT media_group_id INTO v_media_group_id
  FROM messages WHERE id = p_message_id;

  IF v_media_group_id IS NULL THEN
    RETURN false; -- Not part of a media group
  END IF;

  -- Count messages in this media group
  SELECT COUNT(*) INTO v_group_count
  FROM messages
  WHERE media_group_id = v_media_group_id;

  -- Only sync if group has multiple messages or forced
  IF v_group_count > 1 OR p_force_sync THEN
    UPDATE messages
    SET
      analyzed_content = p_analyzed_content,
      updated_at = NOW(),
      processing_state = 'completed',
      processing_completed_at = NOW()
    WHERE media_group_id = v_media_group_id
      AND (p_force_sync OR processing_state != 'completed');

    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

-- 5. Create audit logging function
CREATE OR REPLACE FUNCTION public.xdelo_audit_message_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO message_audit_log (
    message_id,
    operation,
    old_values,
    new_values,
    changed_by,
    changed_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    current_setting('app.current_user_id', true),
    NOW()
  );

  RETURN NEW;
END;
$function$;

-- 6. Create audit trigger
CREATE TRIGGER trg_audit_message_changes
AFTER INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.xdelo_audit_message_changes();

-- 7. Optional: Create media group validation trigger
CREATE OR REPLACE FUNCTION public.xdelo_validate_media_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Prevent changing media_group_id after creation
  IF TG_OP = 'UPDATE' AND NEW.media_group_id IS DISTINCT FROM OLD.media_group_id THEN
    RAISE EXCEPTION 'Cannot change media_group_id after message creation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_validate_media_group
BEFORE UPDATE ON public.messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL)
EXECUTE FUNCTION public.xdelo_validate_media_group();

-- 8. Create function to clean up old processing attempts
CREATE OR REPLACE FUNCTION public.xdelo_cleanup_stalled_processing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE messages
  SET processing_state = 'error',
      error_message = 'Processing timed out',
      last_error_at = NOW()
  WHERE processing_state = 'processing'
    AND processing_started_at < (NOW() - INTERVAL '1 hour');
END;
$function$;

-- Add comment explaining the setup
COMMENT ON FUNCTION public.xdelo_set_caption_pending_trigger() IS
'Trigger function that sets processing_state to pending when a new caption is inserted or updated.
This kicks off the caption processing workflow.';

COMMENT ON TRIGGER trg_process_caption ON public.messages IS
'Trigger that runs before insert/update of captions to initiate processing workflow.';

COMMENT ON FUNCTION public.xdelo_sync_media_group_content IS
'Synchronizes analyzed_content across all messages in a media group when called from direct-caption-processor.';
