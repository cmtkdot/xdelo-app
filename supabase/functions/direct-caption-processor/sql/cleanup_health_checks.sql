
-- Remove unused health check functions
DROP FUNCTION IF EXISTS public.xdelo_check_webhook_health() CASCADE;
DROP FUNCTION IF EXISTS public.xdelo_get_message_processing_stats() CASCADE;

-- Update processing_state enum to remove unused values
ALTER TYPE processing_state RENAME TO processing_state_old;
CREATE TYPE processing_state AS ENUM (
    'initialized',
    'pending',
    'processing',
    'completed',
    'error',
    'partial_success'
);

-- Convert existing column to use new enum
ALTER TABLE messages 
  ALTER COLUMN processing_state TYPE processing_state 
  USING processing_state::text::processing_state;

-- Drop old enum
DROP TYPE processing_state_old;

-- Remove unused audit event types related to health checks
DELETE FROM unified_audit_logs 
WHERE event_type IN (
  'health_check_failed',
  'health_check_warning',
  'processing_status_check'
);

-- Remove unused health check metadata
DELETE FROM gl_sync_metadata 
WHERE operation_type = 'health_check';

-- Clean up any stalled processing states
UPDATE messages
SET processing_state = 'error',
    error_message = 'Reset during health check cleanup',
    updated_at = NOW()
WHERE processing_state = 'processing'
AND processing_started_at < NOW() - INTERVAL '30 minutes';
