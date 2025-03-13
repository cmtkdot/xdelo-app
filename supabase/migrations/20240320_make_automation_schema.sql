-- Create enum for event types
CREATE TYPE make_event_type AS ENUM (
    'message_received',
    'channel_joined',
    'channel_left',
    'user_joined',
    'user_left',
    'media_received',
    'command_received'
);

-- Create enum for event log status
CREATE TYPE make_log_status AS ENUM (
    'pending',
    'success',
    'failed'
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create table for automation rules
CREATE TABLE make_automation_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    event_type make_event_type NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create indexes for automation rules
CREATE INDEX idx_make_automation_rules_event_type ON make_automation_rules(event_type);
CREATE INDEX idx_make_automation_rules_is_active ON make_automation_rules(is_active);
CREATE INDEX idx_make_automation_rules_priority ON make_automation_rules(priority);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_make_automation_rules_updated_at
    BEFORE UPDATE ON make_automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create table for webhook configurations
CREATE TABLE make_webhook_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    event_types TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    field_selection JSONB DEFAULT NULL,
    payload_template JSONB DEFAULT NULL,
    transformation_code TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create indexes for webhook configs
CREATE INDEX idx_make_webhook_configs_is_active ON make_webhook_configs(is_active);
CREATE INDEX idx_make_webhook_configs_created_at ON make_webhook_configs(created_at);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_make_webhook_configs_updated_at
    BEFORE UPDATE ON make_webhook_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create table for event logs
CREATE TABLE make_event_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    webhook_id UUID REFERENCES make_webhook_configs(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    status make_log_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    request_headers JSONB,
    response_code INTEGER,
    response_body TEXT,
    response_headers JSONB,
    duration_ms INTEGER,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    tags TEXT[],
    context JSONB,
    severity TEXT
);

-- Create indexes for event logs
CREATE INDEX idx_make_event_logs_webhook_id ON make_event_logs(webhook_id);
CREATE INDEX idx_make_event_logs_event_type ON make_event_logs(event_type);
CREATE INDEX idx_make_event_logs_status ON make_event_logs(status);
CREATE INDEX idx_make_event_logs_created_at ON make_event_logs(created_at);
CREATE INDEX idx_make_event_logs_completed_at ON make_event_logs(completed_at);

-- Create table for test payloads
CREATE TABLE make_test_payloads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create indexes for test payloads
CREATE INDEX idx_make_test_payloads_event_type ON make_test_payloads(event_type);
CREATE INDEX idx_make_test_payloads_is_template ON make_test_payloads(is_template);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_make_test_payloads_updated_at
    BEFORE UPDATE ON make_test_payloads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create debug tables for webhook testing
CREATE TABLE make_debug_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    webhook_id UUID REFERENCES make_webhook_configs(id) ON DELETE SET NULL,
    start_time TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    end_time TIMESTAMPTZ,
    status TEXT,
    notes TEXT,
    config JSONB
);

CREATE TABLE make_debug_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES make_debug_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    data JSONB,
    level TEXT,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Create indexes for debug tables
CREATE INDEX idx_make_debug_sessions_webhook_id ON make_debug_sessions(webhook_id);
CREATE INDEX idx_make_debug_events_session_id ON make_debug_events(session_id);
CREATE INDEX idx_make_debug_events_event_type ON make_debug_events(event_type);

-- Create function to reorder rules
CREATE OR REPLACE FUNCTION reorder_make_automation_rules(rule_ids UUID[])
RETURNS void AS $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..array_length(rule_ids, 1) LOOP
        UPDATE make_automation_rules
        SET priority = array_length(rule_ids, 1) - i
        WHERE id = rule_ids[i];
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to get event status summary
CREATE OR REPLACE FUNCTION get_make_event_status_summary()
RETURNS TABLE(status TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT status::TEXT, COUNT(*)::BIGINT
    FROM make_event_logs
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY status
    ORDER BY status;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean old event logs
CREATE OR REPLACE FUNCTION make_clean_event_logs(older_than TIMESTAMPTZ, webhook_id UUID DEFAULT NULL, status TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM make_event_logs
  WHERE 
    (webhook_id IS NULL OR make_event_logs.webhook_id = webhook_id) AND
    (status IS NULL OR make_event_logs.status::TEXT = status) AND
    created_at < older_than
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to log a webhook test
CREATE OR REPLACE FUNCTION make_log_webhook_test(webhook_id UUID, payload JSONB)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
  webhook_record make_webhook_configs;
BEGIN
  -- Get the webhook details
  SELECT * INTO webhook_record FROM make_webhook_configs WHERE id = webhook_id;
  
  -- Insert a test event log
  INSERT INTO make_event_logs (webhook_id, event_type, payload, status, context)
  VALUES (webhook_id, 'test', payload, 'pending', jsonb_build_object('is_test', true))
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for all tables
ALTER TABLE make_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE make_webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE make_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE make_test_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE make_debug_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE make_debug_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for make_automation_rules
CREATE POLICY "Users can view automation rules"
    ON make_automation_rules
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create automation rules"
    ON make_automation_rules
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update automation rules"
    ON make_automation_rules
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can delete automation rules"
    ON make_automation_rules
    FOR DELETE
    TO authenticated
    USING (true);

-- RLS policies for make_webhook_configs
CREATE POLICY "Users can view webhook configs"
    ON make_webhook_configs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create webhook configs"
    ON make_webhook_configs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update webhook configs"
    ON make_webhook_configs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can delete webhook configs"
    ON make_webhook_configs
    FOR DELETE
    TO authenticated
    USING (true);

-- RLS policies for make_event_logs
CREATE POLICY "Users can view event logs"
    ON make_event_logs
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create event logs"
    ON make_event_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update event logs"
    ON make_event_logs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can delete event logs"
    ON make_event_logs
    FOR DELETE
    TO authenticated
    USING (true);

-- RLS policies for make_test_payloads
CREATE POLICY "Users can view test payloads"
    ON make_test_payloads
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create test payloads"
    ON make_test_payloads
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can update test payloads"
    ON make_test_payloads
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can delete test payloads"
    ON make_test_payloads
    FOR DELETE
    TO authenticated
    USING (true);

-- Add comments to all tables and columns
COMMENT ON TABLE make_automation_rules IS 'Stores automation rules for Make integration';
COMMENT ON COLUMN make_automation_rules.id IS 'Unique identifier for the automation rule';
COMMENT ON COLUMN make_automation_rules.name IS 'Name of the automation rule';
COMMENT ON COLUMN make_automation_rules.description IS 'Description of what the automation rule does';
COMMENT ON COLUMN make_automation_rules.event_type IS 'Type of event that triggers the automation';
COMMENT ON COLUMN make_automation_rules.conditions IS 'JSON array of conditions that must be met for the automation to run';
COMMENT ON COLUMN make_automation_rules.actions IS 'JSON array of actions to perform when conditions are met';
COMMENT ON COLUMN make_automation_rules.is_active IS 'Whether the automation rule is currently active';
COMMENT ON COLUMN make_automation_rules.priority IS 'Order in which rules should be evaluated (higher number = higher priority)';
COMMENT ON COLUMN make_automation_rules.created_at IS 'Timestamp when the rule was created';
COMMENT ON COLUMN make_automation_rules.updated_at IS 'Timestamp when the rule was last updated';

COMMENT ON TABLE make_webhook_configs IS 'Stores webhook configurations for external integrations';
COMMENT ON COLUMN make_webhook_configs.id IS 'Unique identifier for the webhook';
COMMENT ON COLUMN make_webhook_configs.name IS 'Name of the webhook';
COMMENT ON COLUMN make_webhook_configs.url IS 'URL to send webhook requests to';
COMMENT ON COLUMN make_webhook_configs.description IS 'Description of what the webhook is for';
COMMENT ON COLUMN make_webhook_configs.event_types IS 'Array of event types this webhook should be triggered for';
COMMENT ON COLUMN make_webhook_configs.is_active IS 'Whether the webhook is currently active';
COMMENT ON COLUMN make_webhook_configs.field_selection IS 'JSON object specifying which fields to include or exclude for each event type';
COMMENT ON COLUMN make_webhook_configs.payload_template IS 'Template for structuring the webhook payload with variable substitution';
COMMENT ON COLUMN make_webhook_configs.transformation_code IS 'Custom JavaScript code for transforming the payload before sending';
COMMENT ON COLUMN make_webhook_configs.created_at IS 'Timestamp when the webhook was created';
COMMENT ON COLUMN make_webhook_configs.updated_at IS 'Timestamp when the webhook was last updated';

COMMENT ON TABLE make_event_logs IS 'Logs of webhook events sent to external systems';
COMMENT ON COLUMN make_event_logs.id IS 'Unique identifier for the log entry';
COMMENT ON COLUMN make_event_logs.webhook_id IS 'Reference to the webhook configuration';
COMMENT ON COLUMN make_event_logs.event_type IS 'Type of event that triggered the webhook';
COMMENT ON COLUMN make_event_logs.payload IS 'JSON payload sent to the webhook';
COMMENT ON COLUMN make_event_logs.status IS 'Status of the webhook request (pending, success, failed)';
COMMENT ON COLUMN make_event_logs.error_message IS 'Error message if the webhook request failed';
COMMENT ON COLUMN make_event_logs.request_headers IS 'Headers sent with the webhook request';
COMMENT ON COLUMN make_event_logs.response_code IS 'HTTP status code returned by the webhook';
COMMENT ON COLUMN make_event_logs.response_body IS 'Response body returned by the webhook';
COMMENT ON COLUMN make_event_logs.response_headers IS 'Headers returned by the webhook';
COMMENT ON COLUMN make_event_logs.duration_ms IS 'Duration of the webhook request in milliseconds';
COMMENT ON COLUMN make_event_logs.completed_at IS 'Timestamp when the webhook request completed';
COMMENT ON COLUMN make_event_logs.created_at IS 'Timestamp when the log entry was created';
COMMENT ON COLUMN make_event_logs.tags IS 'Array of tags associated with this event';
COMMENT ON COLUMN make_event_logs.context IS 'Additional context about the event';
COMMENT ON COLUMN make_event_logs.severity IS 'Severity level of the event';

COMMENT ON TABLE make_test_payloads IS 'Stores test payloads for webhook testing';
COMMENT ON COLUMN make_test_payloads.id IS 'Unique identifier for the test payload';
COMMENT ON COLUMN make_test_payloads.name IS 'Name of the test payload';
COMMENT ON COLUMN make_test_payloads.description IS 'Description of what the test payload is for';
COMMENT ON COLUMN make_test_payloads.event_type IS 'Type of event this payload simulates';
COMMENT ON COLUMN make_test_payloads.payload IS 'JSON payload to send to the webhook';
COMMENT ON COLUMN make_test_payloads.is_template IS 'Whether this is a template payload that can be customized';
COMMENT ON COLUMN make_test_payloads.created_at IS 'Timestamp when the test payload was created';
COMMENT ON COLUMN make_test_payloads.updated_at IS 'Timestamp when the test payload was last updated';

COMMENT ON TABLE make_debug_sessions IS 'Stores debug sessions for webhook testing';
COMMENT ON COLUMN make_debug_sessions.id IS 'Unique identifier for the debug session';
COMMENT ON COLUMN make_debug_sessions.name IS 'Name of the debug session';
COMMENT ON COLUMN make_debug_sessions.webhook_id IS 'Reference to the webhook being debugged';
COMMENT ON COLUMN make_debug_sessions.start_time IS 'Timestamp when the debug session started';
COMMENT ON COLUMN make_debug_sessions.end_time IS 'Timestamp when the debug session ended';
COMMENT ON COLUMN make_debug_sessions.status IS 'Status of the debug session';
COMMENT ON COLUMN make_debug_sessions.notes IS 'Notes about the debug session';
COMMENT ON COLUMN make_debug_sessions.config IS 'Configuration for the debug session';

COMMENT ON TABLE make_debug_events IS 'Stores debug events for webhook testing sessions';
COMMENT ON COLUMN make_debug_events.id IS 'Unique identifier for the debug event';
COMMENT ON COLUMN make_debug_events.session_id IS 'Reference to the debug session';
COMMENT ON COLUMN make_debug_events.event_type IS 'Type of debug event';
COMMENT ON COLUMN make_debug_events.data IS 'Data associated with the debug event';
COMMENT ON COLUMN make_debug_events.level IS 'Log level of the debug event';
COMMENT ON COLUMN make_debug_events.timestamp IS 'Timestamp when the debug event occurred'; 