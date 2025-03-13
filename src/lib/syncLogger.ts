
import { supabase } from '@/integrations/supabase/client';

/**
 * Enum of standard event types for unified logging
 */
export enum LogEventType {
  // Message events
  MESSAGE_CREATED = 'message_created',
  MESSAGE_UPDATED = 'message_updated',
  MESSAGE_DELETED = 'message_deleted',
  MESSAGE_PROCESSED = 'message_processed',
  MESSAGE_ANALYZED = 'message_analyzed',
  MESSAGE_ERROR = 'message_error',
  
  // Media processing events
  MEDIA_UPLOADED = 'media_uploaded',
  MEDIA_DOWNLOADED = 'media_downloaded',
  MEDIA_ERROR = 'media_error',
  MEDIA_REPAIRED = 'media_repaired',
  
  // Sync events
  SYNC_STARTED = 'sync_started',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_ERROR = 'sync_error',
  PRODUCT_MATCHED = 'product_matched',
  
  // User actions
  USER_ACTION = 'user_action',
  SYSTEM_REPAIR = 'system_repair',
}

// Type for legacy event types for backward compatibility
export type LegacySyncEventType = "sync_started" | "sync_completed" | "sync_error" | string;

/**
 * Utility function to generate a correlation ID
 */
export function generateCorrelationId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Batch log operations to reduce database calls
let logQueue: Array<{
  table: string;
  data: Record<string, any>;
}> = [];

let queueTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Process the log queue
 */
async function processLogQueue(): Promise<void> {
  if (logQueue.length === 0) return;
  
  const currentQueue = [...logQueue];
  logQueue = [];
  
  try {
    // Group by table
    const tableGroups: Record<string, Record<string, any>[]> = {};
    
    for (const item of currentQueue) {
      if (!tableGroups[item.table]) {
        tableGroups[item.table] = [];
      }
      tableGroups[item.table].push(item.data);
    }
    
    // Process each table group
    await Promise.all(
      Object.entries(tableGroups).map(async ([table, items]) => {
        const { error } = await supabase.from(table).insert(items);
        if (error) {
          console.error(`Failed to log to ${table}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('Error processing log queue:', error);
  }
}

/**
 * Queue a log operation
 */
function queueLogOperation(table: string, data: Record<string, any>): void {
  logQueue.push({ table, data });
  
  if (queueTimeout) {
    clearTimeout(queueTimeout);
  }
  
  queueTimeout = setTimeout(processLogQueue, 500);
}

/**
 * Logs an operation related to a message
 */
export async function logMessageOperation(
  operation: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  queueLogOperation('unified_audit_logs', {
    event_type: operation.toString() as any,
    entity_id: entityId,
    metadata: {
      ...metadata,
      logged_from: 'client',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Logs a sync operation (backward compatibility function)
 */
export async function logSyncOperation(
  syncType: LegacySyncEventType,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  // Map legacy sync types to new event types for better consistency
  let eventType: string;
  switch (syncType) {
    case "sync_started":
      eventType = LogEventType.SYNC_STARTED.toString();
      break;
    case "sync_completed":
      eventType = LogEventType.SYNC_COMPLETED.toString();
      break;
    case "sync_error":
      eventType = LogEventType.SYNC_ERROR.toString();
      break;
    default:
      eventType = syncType;
  }
  
  queueLogOperation('unified_audit_logs', {
    event_type: eventType as any,
    entity_id: entityId,
    metadata: {
      ...metadata,
      original_event_type: syncType,
      logged_from: 'client',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Logs a user action
 */
export async function logUserAction(
  action: string,
  entityId: string,
  userId?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  queueLogOperation('unified_audit_logs', {
    event_type: LogEventType.USER_ACTION.toString() as any,
    entity_id: entityId,
    user_id: userId,
    metadata: {
      ...metadata,
      action,
      logged_from: 'client',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Logs events through the edge function (for more complex events)
 */
export async function logOperationViaEdgeFunction(
  operation: string,
  entityId: string,
  source: string,
  action: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const userId = (await supabase.auth.getUser())?.data?.user?.id;
    
    const { error } = await supabase.functions.invoke('log-operation', {
      body: {
        eventType: operation,
        entityId: entityId,
        metadata: {
          source,
          action,
          userId,
          ...metadata,
          timestamp: new Date().toISOString(),
          correlationId: metadata.correlationId || generateCorrelationId()
        }
      }
    });
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(`Failed to log operation via edge function:`, error);
  }
}

// Legacy function for backward compatibility
export async function logSyncEvent(
  syncType: LegacySyncEventType,
  entityId: string,
  details: Record<string, any> = {}
): Promise<void> {
  return logSyncOperation(syncType, entityId, details);
}

// Make sure to process any remaining logs before the page unloads
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (logQueue.length > 0) {
      processLogQueue();
    }
  });
}
