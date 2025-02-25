# Simplified Audit Logging System

## Overview

This document outlines the simplified audit logging system implemented in the xdelo-app. This system provides a streamlined approach to logging message-related events while removing dependencies on the Telegram integration.

## Key Components

### 1. Unified Audit Logs Table

The `unified_audit_logs` table serves as a centralized repository for all event logs:

```sql
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
```

### 2. Event Types

The system supports the following event types:

```sql
CREATE TYPE audit_event_type AS ENUM (
  'message_created',
  'message_updated',
  'message_deleted',
  'message_analyzed',
  'webhook_received',
  'media_group_synced'
);
```

### 3. Logging Function

The `xdelo_log_event` function provides a consistent way to log events:

```sql
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
```

### 4. Message Deletion Trigger

The system includes a trigger for logging message deletions:

```sql
CREATE OR REPLACE FUNCTION public.xdelo_handle_message_deletion()
RETURNS trigger AS $$
BEGIN
  -- First, backup the message data
  INSERT INTO deleted_messages (...) VALUES (...);

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
```

### 5. Audit Trail View

The `v_message_audit_trail` view provides an easy way to query the audit logs:

```sql
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
```

## Frontend Integration

The frontend uses the `syncLogger.ts` module to log events through the `log-operation` edge function:

```typescript
// Log a deletion operation
import { logDeletion } from "@/lib/syncLogger";

await logDeletion(
  messageId,           // The ID of the message being deleted
  'both',              // Source: 'telegram', 'database', or 'both'
  {                    // Optional metadata
    telegram_message_id: 12345,
    chat_id: 67890,
    operation: 'deletion_started'
  }
);

// Log a message operation (create, update, analyze, sync)
import { logMessageOperation } from "@/lib/syncLogger";

await logMessageOperation(
  'update',            // Operation type: 'create', 'update', 'analyze', 'sync'
  messageId,           // The ID of the message
  {                    // Optional metadata
    old_caption: "Old text",
    new_caption: "New text",
    operation: 'update_started'
  }
);

// Log a user action
import { logUserAction } from "@/lib/syncLogger";

await logUserAction(
  'login',             // The action being performed
  userId,              // The ID of the user
  {                    // Optional metadata
    ip_address: "192.168.1.1",
    user_agent: "Chrome/98.0.4758.102"
  }
);
```

## Edge Function Integration

The `log-operation` edge function maps frontend operations to audit event types:

```typescript
// Map the operation to an event type for the unified_audit_logs table
let eventType;
switch (operation) {
  case 'deletion':
    eventType = 'message_deleted';
    break;
  case 'create':
    eventType = 'message_created';
    break;
  case 'update':
    eventType = 'message_updated';
    break;
  case 'analyze':
    eventType = 'message_analyzed';
    break;
  case 'sync':
    eventType = 'media_group_synced';
    break;
  case 'user_action':
    eventType = 'user_action';
    break;
  default:
    eventType = 'webhook_received'; // Default fallback
}
```

## Querying Logs

You can query the unified audit logs using SQL:

```sql
-- Get all logs for a specific message
SELECT * FROM unified_audit_logs
WHERE entity_id = 'message-uuid-here'
ORDER BY event_timestamp DESC;

-- Get all logs for a specific operation using correlation ID
SELECT * FROM unified_audit_logs
WHERE correlation_id = 'correlation-id-here'
ORDER BY event_timestamp ASC;

-- Use the view for a formatted audit trail
SELECT * FROM v_message_audit_trail
WHERE message_id = 'message-uuid-here';
```

## Differences from Previous Implementation

This simplified version:

1. Focuses on core logging functionality without complex cascading logic
2. Removes dependencies on Telegram-specific operations
3. Provides a cleaner, more straightforward implementation
4. Maintains compatibility with existing frontend and edge function code

## Migration Process

The migration `20250226_simplified_audit_logging.sql` handles:

1. Dropping existing objects to ensure a clean slate
2. Creating the new audit event type enum
3. Creating the unified audit logs table with appropriate indexes
4. Implementing the logging function and message deletion trigger
5. Creating a view for easy querying of the audit trail

## Future Improvements

1. **Admin UI**: Create an admin interface for viewing and searching logs
2. **Metrics Dashboard**: Add visualizations of event patterns and error rates
3. **Notification System**: Send alerts for critical events or errors
4. **Batch Operations**: Support for bulk operations with proper logging
