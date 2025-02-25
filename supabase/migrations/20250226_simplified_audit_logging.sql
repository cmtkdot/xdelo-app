-- Simplified Unified Audit Logging System
-- This migration provides a streamlined version of the audit logging system
-- focusing on core functionality while removing Telegram-specific dependencies

-- First, let's drop everything to ensure a clean slate
DROP VIEW IF EXISTS public.v_message_audit_trail;
DROP TRIGGER IF EXISTS xdelo_trg_message_deletion ON public.messages;
DROP FUNCTION IF EXISTS public.xdelo_handle_message_deletion();
DROP FUNCTION IF EXISTS public.xdelo_log_event();
DROP TABLE IF EXISTS public.unified_audit_logs;
DROP TYPE IF EXISTS audit_event_type CASCADE;

-- Create our audit event type
CREATE TYPE audit_event_type AS ENUM (
  'message_created',
  'message_updated',
  'message_deleted',
  'message_analyzed',
  'webhook_received',
  'media_group_synced'
);

-- Create our new unified audit log table
CREATE TABLE IF NOT EXISTS public.unified_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type audit_event_type NOT NULL,
  entity_id uuid NOT NULL, -- Message ID or related entity
  telegram_message_id bigint,
  chat_id bigint,
  event_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb,
  correlation_id text,
  user_id uuid,
  error_message text,
  CONSTRAINT unified_audit_logs_pkey PRIMARY KEY (id)
);

-- Create indexes for efficient querying
CREATE INDEX idx_unified_audit_logs_event_type ON public.unified_audit_logs(event_type);
CREATE INDEX idx_unified_audit_logs_entity_id ON public.unified_audit_logs(entity_id);
CREATE INDEX idx_unified_audit_logs_correlation_id ON public.unified_audit_logs(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_unified_audit_logs_timestamp ON public.unified_audit_logs(event_timestamp);

-- Create a function to handle audit logging
CREATE OR REPLACE FUNCTION public.xdelo_log_event(
  p_event_type audit_event_type,
  p_entity_id uuid,
  p_telegram_message_id bigint = NULL,
  p_chat_id bigint = NULL,
  p_previous_state jsonb = NULL,
  p_new_state jsonb = NULL,
  p_metadata jsonb = NULL,
  p_correlation_id text = NULL,
  p_user_id uuid = NULL,
  p_error_message text = NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    telegram_message_id,
    chat_id,
    previous_state,
    new_state,
    metadata,
    correlation_id,
    user_id,
    error_message
  ) VALUES (
    p_event_type,
    p_entity_id,
    p_telegram_message_id,
    p_chat_id,
    p_previous_state,
    p_new_state,
    p_metadata,
    p_correlation_id,
    p_user_id,
    p_error_message
  );
END;
$$ LANGUAGE plpgsql;

-- Update the message deletion trigger to use the new unified logging
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_deletion()
RETURNS trigger AS $$
BEGIN
  -- First, backup the message data
  INSERT INTO deleted_messages (
    original_message_id,
    telegram_message_id,
    media_group_id,
    message_caption_id,
    caption,
    file_id,
    file_unique_id,
    public_url,
    mime_type,
    analyzed_content,
    telegram_data,
    deleted_from_telegram,
    deleted_via_telegram,
    user_id
  ) VALUES (
    OLD.id,
    OLD.telegram_message_id,
    OLD.media_group_id,
    OLD.message_caption_id,
    OLD.caption,
    OLD.file_id,
    OLD.file_unique_id,
    OLD.public_url,
    OLD.mime_type,
    OLD.analyzed_content,
    OLD.telegram_data,
    OLD.deleted_from_telegram,
    TG_ARGV[0]::text = 'telegram',
    OLD.user_id
  );

  -- Log the deletion event in the unified audit log
  PERFORM xdelo_log_event(
    'message_deleted'::audit_event_type,
    OLD.id,
    OLD.telegram_message_id,
    OLD.chat_id,
    to_jsonb(OLD),
    NULL,
    jsonb_build_object(
      'deletion_source', TG_ARGV[0],
      'media_group_id', OLD.media_group_id,
      'is_original_caption', OLD.is_original_caption
    ),
    OLD.correlation_id,
    OLD.user_id
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message deletion
CREATE TRIGGER xdelo_trg_message_deletion
    BEFORE DELETE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.xdelo_handle_message_deletion();

-- Create view for easy querying of audit trail
CREATE OR REPLACE VIEW public.v_message_audit_trail AS
SELECT 
    l.event_timestamp,
    l.event_type::text as event_type,
    l.entity_id as message_id,
    l.telegram_message_id,
    l.chat_id,
    l.previous_state,
    l.new_state,
    l.metadata,
    l.correlation_id,
    l.error_message
FROM public.unified_audit_logs l
ORDER BY l.event_timestamp DESC;

-- Add helpful comments
COMMENT ON TABLE public.unified_audit_logs IS 'Centralized audit logging for message-related events';
COMMENT ON FUNCTION public.xdelo_log_event IS 'Helper function to log events in a consistent format';
COMMENT ON FUNCTION public.xdelo_handle_message_deletion IS 'Handles message deletion with proper logging';
COMMENT ON VIEW public.v_message_audit_trail IS 'Convenient view for querying message audit trail';
