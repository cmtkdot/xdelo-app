
-- Phase 1: Database Function and Trigger Consolidation
-- This migration removes redundant logging functions and triggers
-- and consolidates to a unified logging system using unified_audit_logs table

-- First, create a consolidated logging function that all other functions can use
CREATE OR REPLACE FUNCTION xdelo_log_operation(
  p_event_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB DEFAULT NULL,
  p_previous_state JSONB DEFAULT NULL,
  p_new_state JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    metadata,
    previous_state,
    new_state,
    error_message,
    event_timestamp
  ) VALUES (
    p_event_type,
    p_entity_id,
    p_metadata,
    p_previous_state,
    p_new_state,
    p_error_message,
    now()
  );
EXCEPTION
  WHEN others THEN
    -- Silently fail as this is just logging
    RAISE NOTICE 'Error in unified logging: %', SQLERRM;
END;
$$;

-- Drop redundant logging functions
DROP FUNCTION IF EXISTS xdelo_log_sync_operation(text, uuid, jsonb, text);
DROP FUNCTION IF EXISTS xdelo_log_webhook_event(text, uuid, jsonb, text);
DROP FUNCTION IF EXISTS log_gl_sync_operation(text, text, text, text, text);
DROP FUNCTION IF EXISTS gl_log_customer_credits_sync(uuid, text);

-- Phase 5: Cleanup
-- Drop the redundant tables (no need to migrate data as requested)
DROP TABLE IF EXISTS gl_sync_logs CASCADE;
DROP TABLE IF EXISTS webhook_logs CASCADE;
