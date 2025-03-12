# Simplified Audit Logging System

## Architecture Overview

```mermaid
graph TD
    A[Message Events] --> B{Event Type}
    B -->|Create/Update| C[Unified Audit Logs]
    B -->|Delete| D[Deleted Messages]
    C --> E[Audit Trail View]
    D --> F[Deletion Tracking]
    E --> G[Frontend Dashboard]
    F --> G
```

## Core Components

### 1. Unified Audit Logs Table
```sql
CREATE TABLE unified_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type audit_event_type NOT NULL,
  entity_id UUID NOT NULL, -- Message ID
  previous_state JSONB,
  new_state JSONB,
  metadata JSONB,
  error_message TEXT,
  event_timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Enhanced Message Processing Flow
```mermaid
sequenceDiagram
    participant T as Telegram
    participant W as Webhook
    participant D as Database
    participant A as Audit Logger
    
    T->>W: Message Received
    W->>D: Create Message
    D->>A: Log Creation
    W->>D: Update Message
    D->>A: Log Update
    W->>D: Delete Message
    D->>A: Log Deletion
    A->>D: Store in unified_audit_logs
```

## Media Handling Audit Trail

### File Lifecycle Tracking
```mermaid
gantt
    title Media File Lifecycle
    dateFormat  YYYY-MM-DD
    section Storage
    Uploaded      :a1, 2025-03-12, 1h
    Processed     :after a1, 2h
    section Auditing
    Log Creation  :2025-03-12, 1h
    Log Analysis  :2025-03-12, 2h
```

## Frontend Integration

### Audit Log Query Interface
```typescript
interface AuditLogQuery {
  messageId?: string;
  correlationId?: string;
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
}

const fetchAuditLogs = async (query: AuditLogQuery) => {
  return supabase
    .from('unified_audit_logs')
    .select('*')
    .filter('entity_id', 'eq', query.messageId)
    .filter('event_type', 'in', `(${query.eventTypes?.join(',')})`);
};
```

## Error Recovery Patterns

```mermaid
flowchart LR
    A[Processing Error] --> B{Retry Possible?}
    B -->|Yes| C[Increment Retry Count]
    C --> D[Schedule Retry]
    B -->|No| E[Mark Permanent Failure]
    E --> F[Alert Monitoring]
```

## Example Queries

1. Get all edits for a message:
```sql
SELECT * FROM unified_audit_logs
WHERE event_type = 'message_updated'
AND entity_id = 'message-uuid'
ORDER BY event_timestamp DESC;
```

2. Find failed processing attempts:
```sql
SELECT * FROM unified_audit_logs
WHERE event_type = 'processing_error'
AND metadata->>'correlation_id' = 'cid-1234';
```

3. Audit trail for media group:
```sql
SELECT * FROM v_message_audit_trail
WHERE metadata->>'media_group_id' = 'mg-5678';
