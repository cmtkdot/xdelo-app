
-- Start transaction
BEGIN;

-- Function to safely add enum values (idempotent)
CREATE OR REPLACE FUNCTION xdelo_ensure_event_types_exist()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the enum exists 
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_event_type') THEN
    -- Add missing enum values if they don't exist
    -- This uses a dynamic SQL approach to avoid errors if values already exist
    EXECUTE FORMAT('
      DO $$
      BEGIN
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''message_processing_reset'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''direct_caption_processor_success'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''direct_caption_processor_error'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''manual_caption_parsed'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''manual_caption_parser_error'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''queue_processing_error'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''scheduler_process_error'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''scheduler_process_started'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''scheduler_process_completed'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
        
        BEGIN
          ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS ''direct_processing_error'';
        EXCEPTION WHEN duplicate_object THEN
          -- Value already exists, ignore
        END;
      END
      $$;
    ');
  END IF;
END;
$$;

-- Function to clean up legacy queue if it exists
CREATE OR REPLACE FUNCTION xdelo_cleanup_legacy_queue()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the table exists and drop it if it does
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'message_processing_queue') THEN
    DROP TABLE IF EXISTS message_processing_queue;
    
    -- Log the cleanup
    INSERT INTO unified_audit_logs (
      event_type,
      metadata,
      event_timestamp
    ) VALUES (
      'system_maintenance_completed',
      jsonb_build_object(
        'operation', 'legacy_queue_cleanup',
        'timestamp', NOW()
      ),
      NOW()
    );
  END IF;
END;
$$;

-- Run the function immediately to add the missing enum values
SELECT xdelo_ensure_event_types_exist();

COMMIT;
