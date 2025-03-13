
import { supabase } from "@/integrations/supabase/client";
import { logEvent, LogEventType } from "./logUtils";

export interface SyncLogEntry {
  id: string;
  operation: string;
  status: "pending" | "success" | "error";
  details?: any;
  created_at: string;
  updated_at: string;
  error_message?: string;
  user_id?: string;
  sync_counts?: {
    total?: number;
    processed?: number;
    succeeded?: number;
    failed?: number;
  };
}

export interface SyncLogOptions {
  userId?: string;
  metadata?: any;
}

// Helper function to check if a table exists
const tableExists = async (tableName: string): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from('pg_tables')
      .select('count(*)', { count: 'exact', head: true })
      .eq('tablename', tableName);
    
    return !error && count > 0;
  } catch (err) {
    console.error(`Error checking if table ${tableName} exists:`, err);
    return false;
  }
};

export async function createSyncLog(
  operation: string,
  details: any = {},
  options: SyncLogOptions = {}
) {
  try {
    // Log to unified audit logs
    const eventType = getEventTypeFromOperation(operation);
    await logEvent(
      eventType,
      'sync-' + new Date().getTime(),
      {
        operation,
        details,
        status: 'pending',
      },
      {
        user_id: options.userId,
      }
    );

    return { success: true, error: null };
  } catch (err) {
    console.error("Error in createSyncLog:", err);
    return { success: false, error: err };
  }
}

export async function updateSyncLog(
  id: string,
  status: "pending" | "success" | "error",
  details: any = {},
  errorMessage?: string
) {
  try {
    // Log to unified audit logs
    const eventType = status === "success" 
      ? LogEventType.SYNC_COMPLETED 
      : status === "error" 
        ? LogEventType.SYNC_FAILED 
        : LogEventType.SYNC_STARTED;

    await logEvent(
      eventType,
      id,
      {
        status,
        details,
        error_message: errorMessage,
      }
    );

    return { success: true, error: null };
  } catch (err) {
    console.error("Error in updateSyncLog:", err);
    return { success: false, error: err };
  }
}

export async function getSyncLogs(limit = 10) {
  try {
    // Attempt to use unified_audit_logs instead
    const { data, error } = await supabase
      .from("unified_audit_logs")
      .select("*")
      .in('event_type', [
        LogEventType.SYNC_STARTED,
        LogEventType.SYNC_COMPLETED,
        LogEventType.SYNC_FAILED,
        LogEventType.SYNC_PRODUCTS
      ])
      .order("event_timestamp", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to fetch sync logs:", error);
    }

    // Transform the data to match the expected format
    const transformedData = data ? data.map(log => ({
      id: log.id,
      operation: log.event_type,
      status: getStatusFromEventType(log.event_type),
      details: log.metadata,
      created_at: log.event_timestamp,
      updated_at: log.event_timestamp,
      error_message: log.error_message,
      user_id: log.user_id
    })) : [];

    return { success: !error, data: transformedData, error };
  } catch (err) {
    console.error("Error in getSyncLogs:", err);
    return { success: false, error: err };
  }
}

// Helper functions
function getEventTypeFromOperation(operation: string): LogEventType {
  switch (operation) {
    case 'sync_products': return LogEventType.SYNC_PRODUCTS;
    case 'sync_started': return LogEventType.SYNC_STARTED;
    case 'sync_completed': return LogEventType.SYNC_COMPLETED;
    case 'sync_failed': return LogEventType.SYNC_FAILED;
    default: return LogEventType.SYNC_STARTED;
  }
}

function getStatusFromEventType(eventType: string): "pending" | "success" | "error" {
  switch (eventType) {
    case LogEventType.SYNC_COMPLETED: return "success";
    case LogEventType.SYNC_FAILED: return "error";
    default: return "pending";
  }
}

// Re-export logMessageOperation for backward compatibility
export const logMessageOperation = logEvent;
