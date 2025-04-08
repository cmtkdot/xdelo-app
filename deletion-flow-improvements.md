# Deletion Flow and Logging Improvements

## Overview

This document outlines the improvements made to the deletion flow and logging system in the xdelo-app. The changes address several issues with the previous implementation:

1. Multiple uncoordinated deletion paths
2. Inconsistent logging across different parts of the system
3. Lack of cascading deletion for related records
4. No centralized logging strategy
5. Potential for orphaned records if deletion fails

## Key Improvements

### 1. Unified Audit Logging System

A new centralized logging system has been implemented with the following components:

- **Unified Database Table**: `unified_audit_logs` replaces multiple separate logging tables
- **Consistent Log Format**: All logs now follow a standardized structure with event types, correlation IDs, and metadata
- **Frontend Logging**: The `syncLogger.ts` module provides client-side logging that integrates with the server-side system
- **Log Retention**: Automatic cleanup of old logs to prevent database bloat

### 2. Cascading Deletion

The deletion flow now properly handles related records:

- **Media Group Cascading**: When deleting a message that's part of a media group, all related messages are also deleted
- **Storage Cleanup**: Files in storage are automatically deleted when their associated messages are removed
- **Database Triggers**: Database triggers ensure consistent cascading behavior regardless of deletion path

### 3. Correlation IDs

All operations now use correlation IDs to track related actions:

- **Generated IDs**: Each operation generates a unique ID that's passed to all related logs
- **Cross-System Tracking**: The same correlation ID is used across frontend, edge functions, and database operations
- **Debugging Aid**: Makes it easier to trace the complete flow of an operation when troubleshooting

### 4. Error Handling and Recovery

Improved error handling throughout the deletion flow:

- **Detailed Error Logging**: All errors are logged with context about where they occurred
- **Partial Success Handling**: If part of a cascading deletion fails, the system continues with other parts
- **Metadata Preservation**: Even when deletion fails, metadata about the attempt is preserved

## Implementation Details

### Database Changes

1. **New Migration**: `20250225_unified_logging_and_deletion.sql` creates the unified logging system
2. **New Table**: `unified_audit_logs` with appropriate indexes for efficient querying
3. **New View**: `v_deletion_history` for easy querying of deletion history
4. **Updated Triggers**: Improved database triggers for consistent cascading behavior

### Edge Functions

1. **New Function**: `log-operation` for centralized logging from the frontend
2. **Updated Function**: `delete-telegram-message` now handles cascading deletion and uses unified logging
3. **Updated Function**: `cleanup-storage-on-delete` now handles cascading deletion and uses unified logging

### Frontend Changes

1. **Updated Module**: `syncLogger.ts` now provides a simple API for logging different types of operations
2. **Updated Hook**: `useTelegramOperations.ts` now uses the new logging system for all operations

## How to Use the New System

### Logging Operations

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

### Deleting Messages

The deletion flow now supports cascading deletion of media groups:

```typescript
// Delete a message and all related messages in the same media group
import { useTelegramOperations } from "@/hooks/useTelegramOperations";

const { handleDelete } = useTelegramOperations();

// Delete from both Telegram and database (with cascading)
await handleDelete(message, true);

// Delete from database only
await handleDelete(message, false);
```

### Querying Logs

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

-- Get deletion history with related audit logs
SELECT * FROM v_deletion_history
WHERE original_message_id = 'message-uuid-here';
```

## Future Improvements

1. **Admin UI**: Create an admin interface for viewing and searching logs
2. **Metrics Dashboard**: Add visualizations of deletion patterns and error rates
3. **Notification System**: Send alerts for critical deletion failures
4. **Batch Operations**: Support for bulk deletion with proper cascading
