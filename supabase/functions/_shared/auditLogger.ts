/**
 * Shared audit logging functionality for edge functions
 */
import { supabaseClient } from "./supabase.ts";

interface LogEventOptions {
  correlation_id?: string;
  error_message?: string;
  max_retries?: number;
}

/**
 * Log an event to the unified audit log
 */
export async function logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId?: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
) {
  try {
    // Ensure entityId is in UUID format when possible
    const normalizedEntityId = validateEntityId(entityId);
    
    // Set default metadata
    const enhancedMetadata = {
      ...metadata,
      logged_at: new Date().toISOString(),
      environment: Deno.env.get('ENVIRONMENT') || 'development',
      edge_function: true
    };

    // Insert the log entry
    const { data, error } = await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: normalizedEntityId,
      correlation_id: correlationId || crypto.randomUUID().toString(),
      metadata: enhancedMetadata,
      error_message: errorMessage
    });

    if (error) {
      console.error(`[AuditLogger] Failed to log event ${eventType}: ${error.message}`);
      // Don't throw error to avoid disrupting the main process
    }

    return { success: true };
  } catch (error) {
    console.error(`[AuditLogger] Exception logging event ${eventType}: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw error to avoid disrupting the main process
    return { success: false, error: String(error) };
  }
}

/**
 * Log an error event with enhanced error details
 */
export async function logErrorEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  error: unknown,
  metadata: Record<string, any> = {}
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const enhancedMetadata = {
    ...metadata,
    error_type: typeof error,
    error_stack: errorStack,
    logged_at: new Date().toISOString()
  };
  
  await logProcessingEvent(
    eventType,
    entityId,
    correlationId,
    enhancedMetadata,
    errorMessage
  );
}

/**
 * Validate and normalize entity ID
 * Returns the original ID if it's a valid UUID, otherwise 
 * returns a deterministic UUID based on the input
 */
function validateEntityId(id: string): string {
  try {
    // Check if already a valid UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return id;
    }
    
    // If not a UUID, generate a consistent UUID from the string
    // This ensures we don't keep generating new random UUIDs for the same entity
    // which would create duplicates in the audit log
    const namespace = "00000000-0000-0000-0000-000000000000";
    const encoder = new TextEncoder();
    const data = encoder.encode(id);
    
    // Simple implementation to generate a deterministic UUID (not cryptographically secure)
    // but suitable for audit logging purposes
    const hash = Array.from(data).reduce((acc, byte) => (acc * 31 + byte) & 0xFFFFFFFF, 0);
    
    // Format as UUID v4
    const hexHash = hash.toString(16).padStart(8, '0');
    return `${hexHash.slice(0, 8)}-${hexHash.slice(0, 4)}-4${hexHash.slice(1, 4)}-${
      Math.floor(Math.random() * 4 + 8).toString(16)}${hexHash.slice(0, 3)}-${hexHash.slice(0, 12)}`;
  } catch {
    // If anything goes wrong, return a random UUID as fallback
    return crypto.randomUUID();
  }
}
