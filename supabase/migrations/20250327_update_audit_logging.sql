-- Migration to update audit logging to use unified logging system
BEGIN;

-- 1. First update the audit function to use unified logging
CREATE OR REPLACE FUNCTION public.xdelo_audit_message_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Use the unified logging function instead of direct table insert
  PERFORM public.xdelo_log_unified_event(
    'message_change',  -- event_type
    COALESCE(NEW.id, OLD.id),  -- entity_id
    jsonb_build_object(
      'operation', TG_OP,
      'old_values', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      'new_values', CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
      'changed_by', current_setting('app.current_user_id', true)
    )  -- event_data
  );

  RETURN NEW;
END;
$function$;

-- 2. Keep the existing trigger (no changes needed to trigger definition)
COMMENT ON TRIGGER trg_audit_message_changes ON public.messages IS
'Now uses unified logging system instead of direct message_audit_log inserts';

-- 3. Document the change
COMMENT ON DATABASE current_database() IS 'Updated message audit logging to use unified logging system on 2025-03-27';

COMMIT;
