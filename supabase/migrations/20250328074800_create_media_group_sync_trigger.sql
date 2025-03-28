-- Create a trigger function to automatically sync media groups when analyzed_content changes
CREATE OR REPLACE FUNCTION public.trg_media_group_sync_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_media_group_id text;
  v_correlation_id text;
  v_sync_result jsonb;
BEGIN
  -- Only proceed if this message has analyzed_content and is part of a media group
  IF NEW.analyzed_content IS NULL OR NEW.media_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is a change in analyzed_content during an UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Only proceed if analyzed_content actually changed
    -- Skip if there's no change to avoid unnecessary runs
    IF NEW.analyzed_content IS NOT DISTINCT FROM OLD.analyzed_content THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Generate correlation ID for tracing
  v_correlation_id := 'trigger-media-sync-' || gen_random_uuid();

  -- Log trigger execution
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata
  ) VALUES (
    'media_group_sync_trigger_fired',
    NEW.id,
    v_correlation_id,
    jsonb_build_object(
      'media_group_id', NEW.media_group_id,
      'operation', TG_OP,
      'trigger_name', TG_NAME,
      'timestamp', NOW()
    )
  );

  -- Call the sync function
  -- Assuming xdelo_sync_media_group_content exists and accepts these parameters
  -- Note: The original plan passed p_analyzed_content, p_force_sync, p_sync_edit_history
  -- Adjust the call if the actual function signature differs.
  -- Using NEW.id assumes the sync function needs the ID of the message that triggered it.
  v_sync_result := xdelo_sync_media_group_content(
    p_message_id := NEW.id,
    p_analyzed_content := NEW.analyzed_content,
    p_force_sync := true, -- Or determine based on logic if needed
    p_sync_edit_history := NEW.is_edited -- Assuming is_edited exists on messages table
  );

  -- Log the sync result
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata
  ) VALUES (
    'media_group_sync_trigger_completed',
    NEW.id,
    v_correlation_id,
    jsonb_build_object(
      'sync_result', v_sync_result,
      'timestamp', NOW()
    )
  );

  RETURN NEW;
END;
$function$;

-- Create a trigger that fires after INSERT or UPDATE on the messages table
-- Ensures it runs only when media_group_id and analyzed_content are present
CREATE TRIGGER trg_auto_media_group_sync
AFTER INSERT OR UPDATE OF analyzed_content
ON public.messages
FOR EACH ROW
WHEN (NEW.media_group_id IS NOT NULL AND NEW.analyzed_content IS NOT NULL)
EXECUTE FUNCTION public.trg_media_group_sync_function();

-- Grant execute permission on the trigger function to the authenticated role
-- Adjust role if necessary (e.g., service_role if functions run as that)
GRANT EXECUTE ON FUNCTION public.trg_media_group_sync_function() TO authenticated;
-- Consider granting to service_role as well if edge functions might trigger updates
GRANT EXECUTE ON FUNCTION public.trg_media_group_sync_function() TO service_role;

-- Grant usage on the sequence used by gen_random_uuid if needed (usually public by default)
-- GRANT USAGE, SELECT ON SEQUENCE pg_catalog.pg_sequence TO authenticated; -- Example, adjust if needed

-- Ensure the role executing the trigger (usually postgres or the table owner)
-- has permissions to call xdelo_sync_media_group_content and insert into unified_audit_logs.
-- These grants might already exist.

COMMENT ON FUNCTION public.trg_media_group_sync_function() IS 'Trigger function to sync media group content when analyzed_content changes on a message.';
COMMENT ON TRIGGER trg_auto_media_group_sync ON public.messages IS 'Automatically syncs media group content after analyzed_content is inserted or updated for a message belonging to a media group.';
