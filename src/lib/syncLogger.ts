
import { logOperation, logMessageOperation, logSystemEvent } from "./unifiedLogger";

// Event types for logging operations (for backward compatibility)
export type SyncEventType = 
  | "sync_started" 
  | "sync_completed" 
  | "sync_error" 
  | "sync_warning"
  | "sync_message_processed"
  | "sync_message_skipped";

// Map the old sync event types to new unified event types
const syncEventTypeMap = {
  "sync_started": "processing_started",
  "sync_completed": "processing_completed",
  "sync_error": "processing_error",
  "sync_warning": "system_warning",
  "sync_message_processed": "message_analyzed",
  "sync_message_skipped": "processing_state_changed"
};

/**
 * @deprecated Use logOperation from unifiedLogger.ts instead
 */
export const logDeletion = async (
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  await logMessageOperation("deleted", entityId, metadata);
};

/**
 * @deprecated Use logMessageOperation from unifiedLogger.ts instead
 */
export const logMessageOperation = async (
  operation: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  // Map the old operations to new event types
  let eventType;
  
  switch (operation) {
    case "created":
    case "updated":
    case "deleted":
    case "analyzed":
      eventType = `message_${operation}`;
      break;
    default:
      eventType = "user_action";
      metadata = { ...metadata, legacy_operation: operation };
  }
  
  await logOperation({
    entityId,
    eventType: eventType as any,
    metadata: {
      ...metadata,
      source: 'legacy_logger'
    }
  });
};

/**
 * @deprecated Use logSyncOperation from unifiedLogger.ts instead
 */
export const logSyncOperation = async (
  operation: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  // Map the old sync operations to new event types
  let eventType;
  
  if (operation === "sync" || operation === "media_group") {
    eventType = "media_group_synced";
  } else if (operation === "caption") {
    eventType = "caption_synced";
  } else if (operation.startsWith("sync_")) {
    eventType = syncEventTypeMap[operation as SyncEventType] || "system_info";
  } else {
    eventType = "system_info";
    metadata = { ...metadata, legacy_operation: operation };
  }
  
  await logOperation({
    entityId,
    eventType: eventType as any,
    metadata: {
      ...metadata,
      legacy_sync_operation: operation,
      source: 'legacy_sync_logger'
    }
  });
};

/**
 * @deprecated Use logSystemEvent from unifiedLogger.ts instead
 */
export const logSyncWarning = async (
  entityId: string,
  message: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  await logSystemEvent("warning", message, {
    ...metadata,
    entity_id: entityId,
    source: 'legacy_sync_logger'
  });
};
