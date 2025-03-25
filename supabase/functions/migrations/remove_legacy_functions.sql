
-- Migration to remove all legacy functions that have been replaced with JavaScript utilities

-- Remove xdelo_construct_telegram_message_url function if it exists
-- (Already handled in previous migration, including for completeness)
DROP FUNCTION IF EXISTS public.xdelo_construct_telegram_message_url;

-- Remove xdelo_check_media_group_content function which is now replaced with direct queries
DROP FUNCTION IF EXISTS public.xdelo_check_media_group_content;

-- Remove related functions for old media group handling
DROP FUNCTION IF EXISTS public.xdelo_sync_media_group_from_message;
DROP FUNCTION IF EXISTS public.xdelo_media_group_content_details;
DROP FUNCTION IF EXISTS public.xdelo_find_media_group_source;

-- Log the removals in an audit table for tracking
INSERT INTO public.unified_audit_logs (
  event_type,
  entity_id,
  metadata,
  correlation_id
)
VALUES (
  'database_function_cleanup',
  gen_random_uuid(),
  jsonb_build_object(
    'removed_functions', array[
      'xdelo_construct_telegram_message_url',
      'xdelo_check_media_group_content',
      'xdelo_sync_media_group_from_message',
      'xdelo_media_group_content_details',
      'xdelo_find_media_group_source'
    ],
    'reason', 'Legacy function cleanup',
    'replaced_by', 'JavaScript utility functions in _shared/messageUtils.ts'
  ),
  'sql-cleanup-' || gen_random_uuid()
);
