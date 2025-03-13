
import { supabase } from "@/integrations/supabase/client";

/**
 * Unified event types for the logging system
 * These match the event_type values in the unified_audit_logs table
 */
export type UnifiedEventType = 
  // Message lifecycle events
  | "message_created"
  | "message_updated" 
  | "message_deleted"
  | "message_analyzed"
  
  // Processing events
  | "processing_started"
  | "processing_completed"
  | "processing_error"
  | "processing_state_changed"
  
  // Sync events
  | "media_group_synced"
  | "caption_synced"
  
  // Storage events
  | "file_uploaded"
  | "file_deleted"
  | "storage_repaired"
  
  // User actions
  | "user_action"
  
  // System events
  | "system_error"
  | "system_warning"
  | "system_info";

/**
 * Options for the logOperation function
 */
export interface LogOperationOptions {
  entityId: string;
  eventType: UnifiedEventType;
  metadata?: Record<string, any>;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  errorMessage?: string;
  correlationId?: string;
  userId?: string;
}

/**
 * Unified logging function that logs all operations to the unified_audit_logs table
 */
export async function logOperation({
  entityId,
  eventType,
  metadata = {},
  previousState,
  newState,
  errorMessage,
  correlationId = crypto.randomUUID(),
  userId
}: LogOperationOptions): Promise<void> {
  try {
    // Ensure metadata always has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      source: 'web_client'
    };

    await supabase.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      previous_state: previousState,
      new_state: newState,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: correlationId,
      user_id: userId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log to console if logging to DB fails
    console.error('Error logging operation:', error);
    console.info('Failed log entry:', {
      eventType,
      entityId,
      metadata,
      errorMessage,
      correlationId
    });
  }
}

/**
 * Log a message operation (create, update, delete)
 */
export async function logMessageOperation(
  operation: "created" | "updated" | "deleted" | "analyzed",
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await logOperation({
    entityId,
    eventType: `message_${operation}` as UnifiedEventType,
    metadata
  });
}

/**
 * Log a processing operation
 */
export async function logProcessingOperation(
  operation: "started" | "completed" | "error" | "state_changed",
  entityId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  await logOperation({
    entityId,
    eventType: `processing_${operation}` as UnifiedEventType,
    metadata,
    errorMessage
  });
}

/**
 * Log a sync operation
 */
export async function logSyncOperation(
  operation: "media_group" | "caption",
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  const eventType = operation === "media_group" ? 
    "media_group_synced" : "caption_synced";
  
  await logOperation({
    entityId,
    eventType: eventType as UnifiedEventType,
    metadata
  });
}

/**
 * Log a storage operation
 */
export async function logStorageOperation(
  operation: "uploaded" | "deleted" | "repaired",
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await logOperation({
    entityId,
    eventType: `file_${operation}` as UnifiedEventType,
    metadata
  });
}

/**
 * Log a user action
 */
export async function logUserAction(
  entityId: string,
  action: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await logOperation({
    entityId,
    eventType: "user_action",
    metadata: {
      ...metadata,
      action
    }
  });
}

/**
 * Log a system event
 */
export async function logSystemEvent(
  level: "error" | "warning" | "info",
  message: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  await logOperation({
    entityId: "system",
    eventType: `system_${level}` as UnifiedEventType,
    metadata: {
      ...metadata,
      message
    },
    errorMessage: level === "error" ? message : undefined
  });
}

/**
 * Helper function to log errors from try/catch blocks
 */
export function logError(
  entityId: string,
  error: unknown,
  context: Record<string, any> = {}
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  void logOperation({
    entityId,
    eventType: "system_error",
    metadata: {
      ...context,
      stack
    },
    errorMessage
  });
}
