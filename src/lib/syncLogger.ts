
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

/**
 * Logs an operation related to a message
 * 
 * @param operation The operation type (from LogEventType enum)
 * @param entityId The ID of the message or entity
 * @param metadata Additional metadata about the operation
 */
export async function logMessageOperation(
  operation: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: operation,
        entity_id: entityId,
        metadata: {
          ...metadata,
          logged_from: 'client',
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error(`Failed to log message operation:`, error);
  }
}

/**
 * Logs a sync operation (backward compatibility function)
 * 
 * @param syncType The type of sync event
 * @param entityId The ID of the entity being synced
 * @param metadata Additional metadata about the sync
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
      eventType = LogEventType.SYNC_STARTED;
      break;
    case "sync_completed":
      eventType = LogEventType.SYNC_COMPLETED;
      break;
    case "sync_error":
      eventType = LogEventType.SYNC_ERROR;
      break;
    default:
      eventType = syncType;
  }
  
  try {
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: {
          ...metadata,
          original_event_type: syncType,
          logged_from: 'client',
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error(`Failed to log sync operation:`, error);
  }
}

/**
 * Logs a user action
 * 
 * @param action The action performed
 * @param entityId The ID of the entity affected
 * @param userId The ID of the user performing the action
 * @param metadata Additional action details
 */
export async function logUserAction(
  action: string,
  entityId: string,
  userId?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: LogEventType.USER_ACTION,
        entity_id: entityId,
        user_id: userId,
        metadata: {
          ...metadata,
          action,
          logged_from: 'client',
          timestamp: new Date().toISOString()
        }
      });
  } catch (error) {
    console.error(`Failed to log user action:`, error);
  }
}

/**
 * Logs events through the edge function (for more complex events)
 * 
 * @param operation The operation type
 * @param entityId The entity ID
 * @param source The source of the log
 * @param action The specific action
 * @param metadata Additional metadata
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
    
    const { data, error } = await supabase.functions.invoke('log-operation', {
      body: {
        operation,
        messageId: entityId,
        source,
        action,
        userId,
        metadata: {
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
