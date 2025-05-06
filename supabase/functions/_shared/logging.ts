/**
 * Standardized logging module for Edge Functions
 */
import { createSupabaseClient } from './supabaseClient.ts';

// Constants for event types
export const EventType = {
  STORAGE_DELETED: 'storage_deleted',
  MESSAGE_DELETED: 'message_deleted',
  MEDIA_GROUP_DELETED: 'media_group_deleted',
  CAPTION_UPDATED: 'caption_updated',
  WEBHOOK_RECEIVED: 'webhook_received',
  RPC_CALLED: 'rpc_called'
};

// Constants for operation stages
export const OperationStage = {
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL_SUCCESS: 'partial_success',
  SKIPPED: 'skipped'
};

/**
 * Generate a correlation ID for operation tracking
 * @param prefix Optional prefix for the correlation ID
 * @returns A unique correlation ID
 */
export function generateCorrelationId(prefix = 'edge_function') {
  return `${prefix}_${crypto.randomUUID()}`;
}

/**
 * Log an event to the unified audit log system
 * @param eventType The type of event being logged
 * @param entityId The ID of the entity being operated on
 * @param metadata Additional metadata for the log entry
 * @param correlationId Optional correlation ID for tracking operations
 * @param errorMessage Optional error message if the operation failed
 * @returns The correlation ID used (generated if not provided)
 */
export async function logEvent(
  eventType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string,
  errorMessage?: string
) {
  const supabase = createSupabaseClient();
  const logCorrelationId = correlationId || generateCorrelationId();

  try {
    // Add timestamp for all log events
    const enhancedMetadata = {
      ...metadata,
      logged_at: new Date().toISOString()
    };

    // Insert the log entry
    const { error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: enhancedMetadata,
        correlation_id: logCorrelationId,
        error_message: errorMessage
      });

    if (error) {
      console.error(`[${logCorrelationId}] Error logging event:`, error);
    }

    return logCorrelationId;
  } catch (err) {
    console.error(`[${logCorrelationId}] Failed to log event:`, err);
    return logCorrelationId;
  }
}

/**
 * Log an error to the unified audit system
 * @param eventType The type of event where the error occurred
 * @param entityId The ID of the entity being operated on
 * @param errorMessage The error message
 * @param correlationId Optional correlation ID for tracking
 * @param metadata Additional metadata about the error
 * @returns The correlation ID used
 */
export async function logError(
  eventType: string,
  entityId: string,
  errorMessage: string,
  correlationId?: string,
  metadata: Record<string, unknown> = {}
) {
  const enhancedMetadata = {
    ...metadata,
    operation: `${metadata.operation || 'operation'}_failed`,
    error: errorMessage
  };

  return await logEvent(
    eventType,
    entityId,
    enhancedMetadata,
    correlationId,
    errorMessage
  );
}

/**
 * Log the start of an operation
 * @param eventType The event type
 * @param entityId The entity ID
 * @param operationName The name of the operation being started
 * @param metadata Additional metadata
 * @param correlationId Optional correlation ID
 * @returns The correlation ID used
 */
export async function logOperationStart(
  eventType: string,
  entityId: string,
  operationName: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string
) {
  const enhancedMetadata = {
    ...metadata,
    operation: `${operationName}_${OperationStage.STARTED}`,
    started_at: new Date().toISOString()
  };

  return await logEvent(eventType, entityId, enhancedMetadata, correlationId);
}

/**
 * Log the successful completion of an operation
 * @param eventType The event type
 * @param entityId The entity ID
 * @param operationName The name of the operation being completed
 * @param metadata Additional metadata
 * @param correlationId The correlation ID from the start of the operation
 * @returns The correlation ID used
 */
export async function logOperationComplete(
  eventType: string,
  entityId: string,
  operationName: string,
  metadata: Record<string, unknown> = {},
  correlationId: string
) {
  const enhancedMetadata = {
    ...metadata,
    operation: `${operationName}_${OperationStage.COMPLETED}`,
    completed_at: new Date().toISOString()
  };

  return await logEvent(eventType, entityId, enhancedMetadata, correlationId);
}

/**
 * Create a standardized response with correlation ID
 * @param success Whether the operation was successful
 * @param message A message describing the result
 * @param correlationId The correlation ID for the operation
 * @param additionalData Additional data to include in the response
 * @returns A standardized response object
 */
export function createResponse(
  success: boolean,
  message: string,
  correlationId: string,
  additionalData: Record<string, unknown> = {}
) {
  return {
    success,
    message,
    correlation_id: correlationId,
    ...additionalData
  };
}
