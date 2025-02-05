-- Create webhook_logs table with proper constraints
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id),
  telegram_message_id BIGINT NOT NULL,
  chat_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  request_payload JSONB,
  response_payload JSONB,
  status_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  media_group_id TEXT,
  correlation_id TEXT,
  processing_state TEXT
);

-- Create function to log webhook events
CREATE OR REPLACE FUNCTION log_webhook_event(
  p_telegram_message_id BIGINT,
  p_chat_id BIGINT,
  p_event_type TEXT,
  p_request_payload JSONB DEFAULT NULL,
  p_response_payload JSONB DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_media_group_id TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL,
  p_processing_state TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_message_id UUID;
  v_log_id UUID;
BEGIN
  -- Try to find the message_id if it exists
  SELECT id INTO v_message_id
  FROM messages
  WHERE telegram_message_id = p_telegram_message_id
  LIMIT 1;

  -- Insert the log entry
  INSERT INTO webhook_logs (
    message_id,
    telegram_message_id,
    chat_id,
    event_type,
    request_payload,
    response_payload,
    status_code,
    error_message,
    media_group_id,
    correlation_id,
    processing_state
  ) VALUES (
    v_message_id,
    p_telegram_message_id,
    p_chat_id,
    p_event_type,
    p_request_payload,
    p_response_payload,
    p_status_code,
    p_error_message,
    p_media_group_id,
    p_correlation_id,
    p_processing_state
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
