
-- Update the audit_event_type to include all standard event types from LogEventType enum
DO $$
BEGIN
  -- Create a temporary enum type with all the values we want
  CREATE TYPE audit_event_type_new AS ENUM (
    -- Message events
    'message_created',
    'message_updated',
    'message_deleted',
    'message_processed',
    'message_analyzed',
    'message_error',
    
    -- Media processing events
    'media_uploaded',
    'media_downloaded',
    'media_error',
    'media_repaired',
    
    -- Sync events
    'sync_started',
    'sync_completed',
    'sync_error',
    'product_matched',
    
    -- User actions
    'user_action',
    'system_repair',
    
    -- Legacy events (for backward compatibility)
    'duplicate_file_detected',
    'non_media_message_created',
    'processing_state_changed',
    'webhook_received',
    'system'
  );

  -- Update table to use new type
  ALTER TABLE unified_audit_logs 
  ALTER COLUMN event_type TYPE TEXT;
  
  -- Cleanup
  DROP TYPE IF EXISTS audit_event_type CASCADE;
END;
$$;
