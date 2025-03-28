import { supabaseClient } from './supabase.ts'; // Import the Supabase client

/**
 * Unified function to log processing events to the audit log table.
 */
export async function logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown> = {},
  errorMessage?: string
): Promise<void> {
  try {
    // Ensure correlation ID is valid
    const validCorrelationId =
      correlationId &&
      typeof correlationId === 'string' &&
      correlationId.length > 8 ?
      correlationId :
      crypto.randomUUID().toString();

    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: validCorrelationId,
      logged_from: 'edge_function'
    };

    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: validCorrelationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log to console if database logging fails
    console.error(`Error logging event to database: ${eventType}`, error);
  }
}
