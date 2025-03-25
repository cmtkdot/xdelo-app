
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

/**
 * Log an event to the unified_audit_logs table
 */
export async function logMessageEvent(
  supabase: SupabaseClient,
  eventType: string,
  data: {
    entity_id: string;
    telegram_message_id?: number;
    chat_id?: number;
    previous_state?: Record<string, unknown>;
    new_state?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    error_message?: string;
  }
): Promise<void> {
  try {
    // Validate entity_id is provided
    if (!data.entity_id) {
      console.error('Missing entity_id in logMessageEvent, generating UUID');
      data.entity_id = crypto.randomUUID();
    }
    
    // Ensure metadata always has a timestamp
    const metadata = {
      ...(data.metadata || {}),
      event_timestamp: new Date().toISOString()
    };

    const { error } = await supabase.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: data.entity_id,
      telegram_message_id: data.telegram_message_id,
      chat_id: data.chat_id,
      previous_state: data.previous_state,
      new_state: data.new_state,
      metadata: metadata,
      error_message: data.error_message,
      event_timestamp: new Date().toISOString(),
      correlation_id: metadata.correlation_id
    });
    
    if (error) {
      console.error('Error logging event:', error);
      
      // Try with minimized payload if the original is too large
      if (data.previous_state || data.new_state) {
        console.warn('Retrying with simplified payload');
        const { error: retryError } = await supabase.from('unified_audit_logs').insert({
          event_type: eventType,
          entity_id: data.entity_id,
          telegram_message_id: data.telegram_message_id,
          chat_id: data.chat_id,
          metadata: {
            ...metadata,
            previous_state_simplified: true,
            new_state_simplified: true,
            original_error: error.message,
          },
          error_message: data.error_message,
          event_timestamp: new Date().toISOString(),
          correlation_id: metadata.correlation_id
        });
        
        if (retryError) {
          console.error('Error logging simplified event:', retryError);
        }
      }
    }
  } catch (error) {
    console.error('Exception in logMessageEvent:', 
      error instanceof Error ? error.message : String(error));
  }
}
