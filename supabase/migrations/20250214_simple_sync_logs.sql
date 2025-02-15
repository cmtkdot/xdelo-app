-- Create a simple sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    operation_type TEXT NOT NULL,
    status TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at);

-- Add RLS policy
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users to view sync logs"
ON sync_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all authenticated users to insert sync logs"
ON sync_logs FOR INSERT
TO authenticated
WITH CHECK (true);
