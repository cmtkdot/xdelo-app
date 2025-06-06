-- Migration: 20250411162700_cleanup_legacy_media_sync_functions
-- Description: Removes deprecated media group synchronization functions and triggers
-- after implementing the new sync_analyzed_content and sync_pending_media_groups functions

-- First, disable the legacy triggers to prevent them from firing during the migration
ALTER TABLE messages DISABLE TRIGGER after_message_update_sync_media_group;
ALTER TABLE messages DISABLE TRIGGER ensure_caption_fields_sync;

-- Store creation timestamp before removing all functions
DO $$
BEGIN
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    operation_type
  ) VALUES (
    'database_migration',
    'cleanup_legacy_media_sync',
    'system',
    jsonb_build_object(
      'migration_id', '20250411162700',
      'description', 'Removed legacy media synchronization functions in favor of new sync_analyzed_content approach',
      'functions_removed', array[
        'trigger_sync_media_group_captions',
        'sync_media_group_captions',
        'sync_media_group_content',
        'should_sync_media_group',
        'check_media_group_on_message_change',
        'trg_check_media_group_on_message_change'
      ],
      'triggers_removed', array[
        'after_message_update_sync_media_group',
        'ensure_caption_fields_sync'
      ]
    ),
    'migration'
  );
END $$;

-- Drop the triggers
DROP TRIGGER IF EXISTS after_message_update_sync_media_group ON messages;
DROP TRIGGER IF EXISTS ensure_caption_fields_sync ON messages;

-- Drop the sync_caption_fields_trigger function (no longer needed)
DROP FUNCTION IF EXISTS sync_caption_fields_trigger();

-- Drop the legacy functions (in reverse dependency order)
DROP FUNCTION IF EXISTS trigger_sync_media_group_captions();
DROP FUNCTION IF EXISTS sync_media_group_captions(text, text, text, jsonb, processing_state_type);
DROP FUNCTION IF EXISTS sync_media_group_content(text, text, text, jsonb, jsonb, processing_state_type, text);
DROP FUNCTION IF EXISTS should_sync_media_group(jsonb, jsonb);
DROP FUNCTION IF EXISTS check_media_group_on_message_change();
DROP FUNCTION IF EXISTS trg_check_media_group_on_message_change();

-- Now set up a note to check that only the new functions remain:
-- 1. sync_analyzed_content - Main trigger function for synchronizing content
-- 2. sync_pending_media_groups - Scheduled function for processing delayed syncs

-- Verify that our new scheduled job for media group sync is active
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Check if our cron job exists
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync_media_groups_job') THEN
      -- Create it if it doesn't exist
      PERFORM cron.schedule(
        'sync_media_groups_job',
        '*/5 * * * *',  -- Run every 5 minutes
        $$SELECT sync_pending_media_groups()$$
      );
      
      -- Log the job creation
      INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        operation_type
      ) VALUES (
        'database_migration',
        'create_media_sync_job',
        'system',
        jsonb_build_object(
          'migration_id', '20250411162700',
          'job_name', 'sync_media_groups_job',
          'schedule', '*/5 * * * *'
        ),
        'migration'
      );
    END IF;
  END IF;
END $$;
