
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Create a Supabase client for database operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        'X-Client-Info': 'telegram-webhook'
      }
    }
  }
);

/**
 * Log a processing event to the unified_audit_logs table
 * 
 * @param eventType Type of event (e.g., message_created, processing_state_changed)
 * @param entityId ID of the entity this event relates to (e.g., message ID), must be a string
 * @param correlationId Correlation ID for request tracing
 * @param metadata Additional metadata about the event
 * @param errorMessage Optional error message if this is an error event
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('xdelo_log_processing_event', {
      p_event_type: eventType,
      p_entity_id: entityId,
      p_correlation_id: correlationId,
      p_metadata: metadata,
      p_error_message: errorMessage
    });
    
    if (error) {
      console.error('Error logging processing event:', error);
    }
  } catch (error) {
    console.error('Failed to log processing event:', error);
    // We don't throw here to avoid breaking the main process flow
  }
}

/**
 * Update the processing state of a message
 */
export async function xdelo_updateMessageProcessingState(
  messageId: string,
  state: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const { error } = await supabaseClient.rpc('xdelo_update_message_processing_state', {
      p_message_id: messageId,
      p_state: state,
      p_metadata: metadata
    });
    
    if (error) {
      console.error('Error updating message processing state:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to update message processing state:', error);
    throw error;
  }
}
