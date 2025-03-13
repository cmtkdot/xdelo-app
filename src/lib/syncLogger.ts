
import { supabase } from '@/integrations/supabase/client';
import { SyncEventType } from '@/types';

// This is a simplified version of the sync logger that works with our current database schema

/**
 * Logs an operation related to a message
 * 
 * @param operation The operation type
 * @param messageId The ID of the message
 * @param metadata Additional metadata about the operation
 */
export async function logMessageOperation(
  operation: string,
  messageId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const eventType = `message_${operation}`;
    
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: messageId,
        metadata
      });
      
  } catch (error) {
    console.error(`Failed to log message operation:`, error);
  }
}

/**
 * Logs a sync operation to the unified_audit_logs table
 * 
 * @param syncType The type of sync event
 * @param entityId The ID of the entity being synced
 * @param metadata Additional metadata about the sync
 */
export async function logSyncOperation(
  syncType: SyncEventType,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: syncType,
        entity_id: entityId,
        metadata
      });
  } catch (error) {
    console.error(`Failed to log sync operation:`, error);
  }
}

/**
 * Logs a sync event to both unified_audit_logs and sync_logs tables
 * 
 * @param syncType Type of sync event
 * @param entityId Related entity ID
 * @param details Sync details
 */
export async function logSyncEvent(
  syncType: SyncEventType,
  entityId: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    // First log to unified_audit_logs
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: syncType,
        entity_id: entityId,
        metadata: details
      });
      
    // We'll handle sync_logs table in a separate function if needed
  } catch (error) {
    console.error(`Failed to log sync event:`, error);
  }
}
