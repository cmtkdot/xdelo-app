
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

export async function createSyncLog(
  operation: string,
  details: any = {},
  options: SyncLogOptions = {}
) {
  try {
    // Map string operation to LogEventType when possible
    let eventType: LogEventType | string;
    
    // Try to get the corresponding LogEventType
    switch (operation) {
      case 'sync_products': 
        eventType = LogEventType.SYNC_PRODUCTS;
        break;
      case 'sync_started': 
        eventType = LogEventType.SYNC_STARTED;
        break;
      case 'sync_completed': 
        eventType = LogEventType.SYNC_COMPLETED;
        break;
      case 'sync_failed': 
        eventType = LogEventType.SYNC_FAILED;
        break;
      default: 
        eventType = operation;
    }

    // Log to unified audit logs
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
    // Determine the appropriate event type based on status
    let eventType: LogEventType;
    
    if (status === "success") {
      eventType = LogEventType.SYNC_COMPLETED;
    } else if (status === "error") {
      eventType = LogEventType.SYNC_FAILED;
    } else {
      eventType = LogEventType.SYNC_STARTED;
    }

    // Log to unified audit logs
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
        LogEventType.SYNC_STARTED.toString(),
        LogEventType.SYNC_COMPLETED.toString(),
        LogEventType.SYNC_FAILED.toString(),
        LogEventType.SYNC_PRODUCTS.toString()
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
function getEventTypeFromOperation(operation: string): LogEventType | string {
  switch (operation) {
    case 'sync_products': return LogEventType.SYNC_PRODUCTS;
    case 'sync_started': return LogEventType.SYNC_STARTED;
    case 'sync_completed': return LogEventType.SYNC_COMPLETED;
    case 'sync_failed': return LogEventType.SYNC_FAILED;
    default: return operation;
  }
}

function getStatusFromEventType(eventType: string): "pending" | "success" | "error" {
  switch (eventType) {
    case LogEventType.SYNC_COMPLETED.toString(): return "success";
    case LogEventType.SYNC_FAILED.toString(): return "error";
    default: return "pending";
  }
}

// Re-export logMessageOperation for backward compatibility
export const logMessageOperation = logEvent;
