import { supabaseClient } from './supabase.ts';

/**
 * Log a processing event to the unified_audit_logs table
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
) {
  try {
    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: correlationId,
      logged_from: 'edge_function'
    };
    
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: correlationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
} 