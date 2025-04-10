-- Migration to remove the foreign key constraint from unified_audit_logs table
-- This allows logging events that don't necessarily reference an existing message

-- Drop the foreign key constraint
ALTER TABLE public.unified_audit_logs
DROP CONSTRAINT IF EXISTS fk_unified_audit_logs_messages;

-- Add comment explaining the change
COMMENT ON TABLE public.unified_audit_logs IS 'Audit logs for all system events. The entity_id field can reference messages but is not required to.';
