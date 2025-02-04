-- Update RLS policies to allow public access
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_audit_log DISABLE ROW LEVEL SECURITY;

-- Enable RLS but allow all operations
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access"
ON messages FOR ALL
TO public
USING (true);

CREATE POLICY "Allow public access to audit log"
ON analysis_audit_log FOR ALL
TO public
USING (true);