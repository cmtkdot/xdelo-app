-- XdeloMedia Custom Types Migration
-- This script creates all the custom ENUM types needed for the application

-- Drop existing types if migrating to a clean database (uncomment if needed)
-- DROP TYPE IF EXISTS processing_state_type CASCADE;
-- DROP TYPE IF EXISTS telegram_chat_type CASCADE;
-- DROP TYPE IF EXISTS telegram_other_message_type CASCADE;
-- DROP TYPE IF EXISTS message_operation_type CASCADE;
-- DROP TYPE IF EXISTS audit_event_type CASCADE;
-- DROP TYPE IF EXISTS make_event_type CASCADE;
-- DROP TYPE IF EXISTS make_log_status CASCADE;
-- DROP TYPE IF EXISTS error_type CASCADE;
-- DROP TYPE IF EXISTS sync_status_type CASCADE;
-- DROP TYPE IF EXISTS sync_status CASCADE;
-- DROP TYPE IF EXISTS sync_operation CASCADE;
-- DROP TYPE IF EXISTS sync_direction_type CASCADE;
-- DROP TYPE IF EXISTS sync_resolution_status CASCADE;
-- DROP TYPE IF EXISTS processing_state CASCADE;
-- DROP TYPE IF EXISTS document_status_type CASCADE;
-- DROP TYPE IF EXISTS client_type CASCADE;
-- DROP TYPE IF EXISTS account_type CASCADE;

-- Create the processing state type for message processing
CREATE TYPE IF NOT EXISTS processing_state_type AS ENUM (
    'initialized',
    'pending',
    'pending_analysis',
    'processing',
    'completed',
    'processed',
    'error',
    'duplicate',
    'download_failed_forwarded'
);

-- Create the Telegram chat type enum
CREATE TYPE IF NOT EXISTS telegram_chat_type AS ENUM (
    'private',
    'group',
    'supergroup',
    'channel',
    'unknown'
);

-- Create the Telegram other message type enum
CREATE TYPE IF NOT EXISTS telegram_other_message_type AS ENUM (
    'text',
    'sticker',
    'venue',
    'location',
    'contact',
    'game',
    'poll',
    'dice',
    'chat_member',
    'my_chat_member',
    'chat_join_request',
    'message_created',
    'message_deleted',
    'message_updated',
    'message_analyzed',
    'media_group_synced',
    'edited_channel_post',
    'callback_query',
    'inline_query',
    'chosen_inline_result',
    'shipping_query',
    'pre_checkout_query',
    'poll_answer',
    'webhook_received'
);

-- Create the message operation type enum
CREATE TYPE IF NOT EXISTS message_operation_type AS ENUM (
    'message_create',
    'message_update',
    'message_delete',
    'message_edit',
    'message_forward',
    'caption_change',
    'media_change',
    'media_redownload',
    'group_sync'
);

-- Create the audit event type enum
CREATE TYPE IF NOT EXISTS audit_event_type AS ENUM (
    'webhook_received',
    'message_created',
    'message_updated',
    'message_edited',
    'message_deleted',
    'message_forwarded',
    'media_group_synced',
    'media_group_edit_synced',
    'media_group_content_synced',
    'media_group_content_synced_direct',
    'media_group_content_synced_batch',
    'media_group_edit_history_synced',
    'media_group_history_synced',
    'media_group_version_updated',
    'media_group_sync_triggered',
    'media_group_sync_validated',
    'media_group_sync_error',
    'media_group_sync_conflict',
    'forward_media_synced',
    'forward_status_changed',
    'file_redownload_flagged',
    'edit_content_propagated',
    'duplicate_detected',
    'message_queued_for_processing',
    'message_processing_started',
    'message_processing_completed',
    'message_processing_failed',
    'message_processing_error',
    'message_processing_retry',
    'message_analyzed',
    'queue_processing_started',
    'queue_processing_completed',
    'analyze_message_started',
    'analyze_message_failed',
    'caption_analysis_prepared',
    'caption_analysis_directly_triggered',
    'caption_analysis_error',
    'caption_analysis_retry',
    'direct_caption_analysis_triggered',
    'direct_processing_error',
    'edge_function_error',
    'edge_function_fallback',
    'system_configuration_updated',
    'trigger_auto_queue_activated',
    'trigger_queue_error',
    'health_check_performed'
);

-- Create make event type enum
CREATE TYPE IF NOT EXISTS make_event_type AS ENUM (
    'message_received',
    'media_received',
    'media_group_received',
    'command_received',
    'message_edited',
    'message_deleted',
    'message_forwarded',
    'caption_updated',
    'processing_completed',
    'user_joined',
    'user_left',
    'channel_joined',
    'channel_left'
);

-- Create make log status enum
CREATE TYPE IF NOT EXISTS make_log_status AS ENUM (
    'success',
    'pending',
    'failed'
);

-- Create error type enum
CREATE TYPE IF NOT EXISTS error_type AS ENUM (
    'API_ERROR',
    'NETWORK_ERROR',
    'VALIDATION_ERROR',
    'RATE_LIMIT',
    'TRANSFORM_ERROR'
);

-- Create sync status type enum
CREATE TYPE IF NOT EXISTS sync_status_type AS ENUM (
    'started',
    'processing',
    'completed',
    'failed'
);

-- Create sync status enum
CREATE TYPE IF NOT EXISTS sync_status AS ENUM (
    'pending',
    'synced',
    'error',
    'locked'
);

-- Create sync operation enum
CREATE TYPE IF NOT EXISTS sync_operation AS ENUM (
    'create',
    'update',
    'delete',
    'sync'
);

-- Create sync direction type enum
CREATE TYPE IF NOT EXISTS sync_direction_type AS ENUM (
    'to_glide',
    'to_supabase',
    'both'
);

-- Create sync resolution status enum
CREATE TYPE IF NOT EXISTS sync_resolution_status AS ENUM (
    'pending',
    'resolved',
    'ignored',
    'push_to_glide',
    'delete_from_supabase'
);

-- Create processing state enum
CREATE TYPE IF NOT EXISTS processing_state AS ENUM (
    'initialized',
    'pending',
    'processing',
    'completed',
    'processed',
    'error',
    'partial_success'
);

-- Create document status type enum
CREATE TYPE IF NOT EXISTS document_status_type AS ENUM (
    'draft',
    'pending',
    'paid',
    'overdue',
    'void'
);

-- Create client type enum
CREATE TYPE IF NOT EXISTS client_type AS ENUM (
    'Customer',
    'Vendor',
    'Customer & Vendor'
);

-- Create account type enum
CREATE TYPE IF NOT EXISTS account_type AS ENUM (
    'Customer',
    'Vendor',
    'Customer & Vendor'
);
