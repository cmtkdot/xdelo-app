-- Enable row level security
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Enable real-time for the messages table
BEGIN;
  INSERT INTO supabase_realtime.subscription (subscription_id, entity, filters, claims)
  VALUES ('messages_all', 'messages', '{}'::jsonb, '{}'::jsonb)
  ON CONFLICT (subscription_id) DO NOTHING;
COMMIT;