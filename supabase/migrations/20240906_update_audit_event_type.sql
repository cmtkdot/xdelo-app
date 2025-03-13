
-- Update the audit_event_type to include all standard event types from LogEventType enum
ALTER TABLE unified_audit_logs 
ALTER COLUMN event_type TYPE TEXT;

-- Create an index on event_type for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON unified_audit_logs(event_type);

-- Create an index on entity_id for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON unified_audit_logs(entity_id);

-- Add comment to table for documentation
COMMENT ON TABLE unified_audit_logs IS 'Unified logging system for all application events';
