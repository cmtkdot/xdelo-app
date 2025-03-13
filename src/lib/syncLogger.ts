
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogOperation {
  action: string;
  target_id: string;
  metadata?: Record<string, any>;
  event_timestamp?: string;
  session_id?: string;
  parent_id?: string;
  result?: "success" | "error";
  error_message?: string;
  source?: string;
  level?: LogLevel;
}

/**
 * Logs a user operation on a message
 * 
 * @param action The action being performed (e.g., update, delete)
 * @param messageId The ID of the message being operated on
 * @param metadata Additional metadata about the operation
 */
export async function logMessageOperation(
  action: string,
  messageId: string,
  metadata?: Record<string, any>,
  level: LogLevel = "info"
) {
  try {
    const operationId = uuidv4();
    const eventTimestamp = new Date().toISOString();
    
    const { error } = await supabase
      .from('message_operations_log')
      .insert({
        id: operationId,
        action,
        target_id: messageId,
        metadata: {
          ...metadata,
          level,
          timestamp: eventTimestamp,
        },
        event_timestamp: eventTimestamp,
        source: 'webapp'
      });
    
    if (error) {
      console.error('Failed to log message operation:', error);
    }
    
    return { id: operationId, success: !error, timestamp: eventTimestamp };
  } catch (err) {
    console.error('Error in logMessageOperation:', err);
    return { success: false, error: err };
  }
}

/**
 * Logs a sync operation
 */
export async function logSyncOperation(
  table: string,
  record_id: string,
  operation: string,
  status: "success" | "error" = "success",
  error_message?: string
) {
  try {
    const syncLogId = uuidv4();
    const eventTimestamp = new Date().toISOString();
    
    // Use a type cast here to satisfy TypeScript - this table name is dynamically determined
    // We know this is safe because we're explicitly passing in the table name
    const { error } = await supabase
      .from('sync_logs' as any)
      .insert({
        id: syncLogId,
        table_name: table,
        record_id,
        operation,
        status,
        error_message,
        created_at: eventTimestamp
      });
    
    if (error) {
      console.error('Failed to log sync operation:', error);
    }
    
    // Also log to unified audit logs
    if (operation !== 'read') {
      await supabase
        .from('unified_audit_logs')
        .insert({
          id: uuidv4(),
          event_type: `sync_${operation}`,
          entity_id: record_id,
          metadata: {
            table_name: table,
            operation,
            status,
            error_message,
            sync_log_id: syncLogId
          },
          created_at: eventTimestamp
        });
    }
    
    return { id: syncLogId, success: !error, timestamp: eventTimestamp };
  } catch (err) {
    console.error('Error in logSyncOperation:', err);
    return { success: false, error: err };
  }
}

/**
 * Logs a system operation for audit purposes
 */
export async function logSystemOperation(
  eventType: string,
  entityId: string,
  previousState?: Record<string, any>,
  newState?: Record<string, any>,
  metadata?: Record<string, any>
) {
  try {
    const auditLogId = uuidv4();
    const eventTimestamp = new Date().toISOString();
    
    const { error } = await supabase
      .from('unified_audit_logs')
      .insert({
        id: auditLogId,
        event_type: eventType,
        entity_id: entityId,
        previous_state: previousState,
        new_state: newState,
        metadata: {
          ...metadata,
          source: 'webapp',
          timestamp: eventTimestamp
        },
        created_at: eventTimestamp
      });
    
    if (error) {
      console.error('Failed to log system operation:', error);
    }
    
    return { id: auditLogId, success: !error, timestamp: eventTimestamp };
  } catch (err) {
    console.error('Error in logSystemOperation:', err);
    return { success: false, error: err };
  }
}

export default {
  logMessageOperation,
  logSyncOperation,
  logSystemOperation
};
