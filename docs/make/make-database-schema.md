# Make Automation System Database Schema

This document provides detailed information about the database schema for the Make Automation System.

## Schema Overview

The Make Automation System uses PostgreSQL tables and functions in the Supabase database. The schema consists of:

- Custom PostgreSQL types
- Tables for storing automation rules, webhooks, logs, and test data
- Indexes for optimized query performance
- Functions for common operations
- Row-level security (RLS) policies

## Database Types

### make_event_type

An enum type that defines the supported event types in the system:

```sql
CREATE TYPE make_event_type AS ENUM (
    'message_received',
    'channel_joined',
    'channel_left',
    'user_joined',
    'user_left',
    'media_received',
    'command_received'
);
```

### make_log_status

An enum type that defines the possible statuses for event logs:

```sql
CREATE TYPE make_log_status AS ENUM (
    'pending',
    'success',
    'failed'
);
```

## Tables

### make_automation_rules

Stores automation rule definitions including triggers, conditions, and actions.

```sql
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
```

#### Indexes
- `idx_make_automation_rules_event_type`: Optimizes queries filtering by event type
- `idx_make_automation_rules_is_active`: Optimizes queries filtering by active status
- `idx_make_automation_rules_priority`: Optimizes sorting by priority

### make_webhook_configs

Contains webhook endpoint configurations for event delivery.

```sql
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
```

#### Indexes
- `idx_make_webhook_configs_is_active`: Optimizes queries filtering by active status
- `idx_make_webhook_configs_created_at`: Optimizes sorting by creation date

### make_event_logs

Records event processing history for monitoring and debugging.

```sql
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
```

#### Indexes
- `idx_make_event_logs_webhook_id`: Optimizes queries filtering by webhook ID
- `idx_make_event_logs_event_type`: Optimizes queries filtering by event type
- `idx_make_event_logs_status`: Optimizes queries filtering by status
- `idx_make_event_logs_created_at`: Optimizes sorting by creation date
- `idx_make_event_logs_completed_at`: Optimizes sorting by completion date

### make_test_payloads

Stores test event data for testing automation rules.

```sql
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
```

#### Indexes
- `idx_make_test_payloads_event_type`: Optimizes queries filtering by event type
- `idx_make_test_payloads_is_template`: Optimizes queries filtering by template status

### make_debug_sessions

Tracks debugging sessions for webhook testing.

```sql
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
```

#### Indexes
- `idx_make_debug_sessions_webhook_id`: Optimizes queries filtering by webhook ID

### make_debug_events

Stores debugging events for webhook testing.

```sql
CREATE TABLE make_debug_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES make_debug_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    data JSONB,
    level TEXT,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
```

#### Indexes
- `idx_make_debug_events_session_id`: Optimizes queries filtering by session ID
- `idx_make_debug_events_event_type`: Optimizes queries filtering by event type

## Database Functions

### update_updated_at_column()

Updates the `updated_at` timestamp when a record is modified.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### reorder_make_automation_rules(rule_ids UUID[])

Reorders automation rules based on the provided array of rule IDs.

```sql
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
```

### get_make_event_status_summary()

Returns a summary of event log statuses.

```sql
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
```

### make_clean_event_logs(older_than TIMESTAMPTZ, webhook_id UUID, status TEXT)

Deletes old event logs based on specified criteria.

```sql
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
```

### make_log_webhook_test(webhook_id UUID, payload JSONB)

Creates a test event log for a webhook.

```sql
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
```

## Row-Level Security (RLS) Policies

The schema includes RLS policies to secure the data:

```sql
-- Enable RLS on all tables
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

-- Similar policies exist for other tables
```

## Database Relationships

### Foreign Keys

- `make_event_logs.webhook_id` references `make_webhook_configs.id`
- `make_debug_sessions.webhook_id` references `make_webhook_configs.id`
- `make_debug_events.session_id` references `make_debug_sessions.id`

## JSON Structures

### conditions (JSONB)

The `conditions` field in `make_automation_rules` stores an array of condition objects:

```json
[
  {
    "field": "message.text",
    "operator": "contains",
    "value": "hello"
  },
  {
    "field": "message.from.id",
    "operator": "equals",
    "value": 123456789
  }
]
```

### actions (JSONB)

The `actions` field in `make_automation_rules` stores an array of action objects:

```json
[
  {
    "type": "forward_webhook",
    "config": {
      "url": "https://example.com/webhook",
      "headers": {
        "X-Custom-Header": "value"
      }
    }
  },
  {
    "type": "send_notification",
    "config": {
      "message": "New message received: {{message.text}}"
    }
  }
]
```

## Schema Migrations

The Make Automation System schema is defined in the migration file:
- `xdelo-app/supabase/migrations/20240320_make_automation_schema.sql`

When making changes to the schema:

1. Create a new migration file with a timestamp prefix
2. Document the changes in the migration file
3. Test migrations in a development environment before deploying to production 