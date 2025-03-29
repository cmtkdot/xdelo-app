
import { supabaseClient } from "./supabase.ts";

/**
 * Log an event to the unified audit log
 */
export async function logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId || `audit-${crypto.randomUUID()}`,
      metadata: metadata || {},
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event ${eventType}:`, error);
    // Don't throw, we don't want to crash the main process
  }
}

/**
 * Log an error event to the unified audit log
 */
export async function logErrorEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  error: unknown,
  metadata?: Record<string, any>
) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId,
      error_message: errorMessage,
      metadata: {
        ...metadata,
        error_stack: errorStack,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (logError) {
    console.error(`Error logging error event ${eventType}:`, logError);
    // Don't throw, we don't want to crash the main process
  }
}
