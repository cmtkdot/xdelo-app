
# Unified Logging System

This document describes the unified logging system implemented to standardize event tracking and error reporting across the application.

## Core Principles

1. **Single Source of Truth**: All logs go to the `unified_audit_logs` table
2. **Standardized Event Types**: Well-defined event types that cover all operations
3. **Correlation IDs**: Every sequence of related operations shares a correlation ID
4. **Rich Metadata**: Structured metadata to enable powerful filtering and analysis
5. **Consistent Interface**: Same logging interface used across all parts of the application

## Event Types

The system uses a unified set of event types:

### Message Lifecycle Events
- `message_created` - A new message has been created
- `message_updated` - A message has been updated
- `message_deleted` - A message has been deleted
- `message_analyzed` - A message's caption has been analyzed

### Processing Events
- `processing_started` - Message processing has started
- `processing_completed` - Message processing has completed successfully
- `processing_error` - An error occurred during message processing
- `processing_state_changed` - The processing state of a message has changed

### Sync Events
- `media_group_synced` - A media group has been synchronized
- `caption_synced` - A caption has been synchronized across a media group

### Storage Events
- `file_uploaded` - A file has been uploaded to storage
- `file_deleted` - A file has been deleted from storage
- `storage_repaired` - Storage issues have been fixed

### User Actions
- `user_action` - A user performed an action in the UI

### System Events
- `system_error` - A system error occurred
- `system_warning` - A warning was generated
- `system_info` - General system information was logged

## Database Schema

The `unified_audit_logs` table has the following structure:

```sql
CREATE TABLE unified_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  correlation_id UUID,
  user_id UUID,
  previous_state JSONB,
  new_state JSONB,
  metadata JSONB,
  error_message TEXT,
  event_timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Logging Functions

### Client-Side Logging

The main logging functions are in `src/lib/unifiedLogger.ts`:

```typescript
// Generic logging function
logOperation({
  entityId,
  eventType,
  metadata,
  previousState,
  newState,
  errorMessage,
  correlationId,
  userId
})

// Specialized helpers
logMessageOperation(operation, entityId, metadata)
logProcessingOperation(operation, entityId, metadata, errorMessage)
logSyncOperation(operation, entityId, metadata)
logStorageOperation(operation, entityId, metadata)
logUserAction(entityId, action, metadata)
logSystemEvent(level, message, metadata)
logError(entityId, error, context)
```

### Server-Side Logging

Edge functions use `supabase/functions/_shared/databaseOperations.ts`:

```typescript
xdelo_logEvent(
  eventType,
  entityId,
  correlationId,
  metadata,
  errorMessage,
  previousState,
  newState
)
```

## Legacy Compatibility

The system maintains backward compatibility through:

1. Legacy wrapper functions in `src/lib/syncLogger.ts` that map to the new system
2. Dual logging to both `gl_sync_logs` and `unified_audit_logs` during the transition period
3. Event type mapping for older code that uses string-based event types

## Query Examples

### Find errors for a specific message

```sql
SELECT * FROM unified_audit_logs
WHERE entity_id = '123e4567-e89b-12d3-a456-426614174000'
AND event_type LIKE '%error%'
ORDER BY event_timestamp DESC;
```

### Track processing timeline

```sql
SELECT 
  event_type, 
  event_timestamp,
  metadata->>'action' as action
FROM unified_audit_logs
WHERE correlation_id = '123e4567-e89b-12d3-a456-426614174000'
ORDER BY event_timestamp ASC;
```

### Find system errors

```sql
SELECT 
  entity_id,
  error_message,
  metadata,
  event_timestamp
FROM unified_audit_logs
WHERE event_type = 'system_error'
ORDER BY event_timestamp DESC
LIMIT 100;
```

## Migration Plan

1. **Phase 1 (Current)**: Implement unified logger with backward compatibility
2. **Phase 2**: Update all components to use the new unified logger
3. **Phase 3**: Monitor usage and verify all logging goes through the unified system
4. **Phase 4**: Remove legacy logging systems after 30 days of stability

## Best Practices

1. **Always use correlation IDs** for related operations
2. **Include relevant metadata** but avoid sensitive information
3. **Use the specialized helper functions** when appropriate
4. **Handle errors** in logging operations to prevent cascading failures
5. **Keep metadata JSON structures flat** for easier querying

## Conclusion

The unified logging system provides a consistent approach to tracking and troubleshooting application behavior. By centralizing all logs in a single table with standardized event types, we can more effectively monitor and debug the application.
