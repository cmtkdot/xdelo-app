
CREATE TABLE IF NOT EXISTS other_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  telegram_message_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  chat_type text,
  message_type text NOT NULL,
  telegram_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  correlation_id text
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_other_messages_telegram_message_id ON other_messages(telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_other_messages_chat_id ON other_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_other_messages_message_type ON other_messages(message_type);
