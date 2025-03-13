
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

interface LogOperation {
  action: string;
  target_id: string;
  metadata?: Record<string, any>;
  event_timestamp?: string;
  session_id?: string;
  parent_id?: string;
  result?: "success" | "error";
  error_message?: string;
  source?: string;
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
  metadata?: Record<string, any>
) {
  try {
    const operationId = uuidv4();
    
    const { error } = await supabase
      .from('message_operations_log')
      .insert({
        id: operationId,
        action,
        target_id: messageId,
        metadata,
        event_timestamp: new Date().toISOString(),
        source: 'webapp'
      });
    
    if (error) {
      console.error('Failed to log message operation:', error);
    }
    
    return { id: operationId, success: !error };
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
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Failed to log sync operation:', error);
    }
    
    return { id: syncLogId, success: !error };
  } catch (err) {
    console.error('Error in logSyncOperation:', err);
    return { success: false, error: err };
  }
}

export default {
  logMessageOperation,
  logSyncOperation
};
