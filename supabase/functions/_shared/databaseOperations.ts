
import { createSupabaseClient } from "./supabase.ts";

/**
 * Log a processing event to the unified_audit_logs table
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: {
          ...metadata,
          logged_at: new Date().toISOString()
        },
        error_message: errorMessage,
        correlation_id: correlationId,
        event_timestamp: new Date().toISOString()
      });
      
    if (error) {
      console.error(`Error logging event ${eventType}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception logging event ${eventType}:`, error);
    return false;
  }
}

/**
 * Update a message with error information
 */
export async function xdelo_updateMessageWithError(
  messageId: string,
  errorMessage: string,
  correlationId: string,
  errorType?: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: errorMessage,
        error_type: errorType || 'processing_error',
        last_error_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error updating message ${messageId} with error:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception updating message ${messageId} with error:`, error);
    return false;
  }
}

/**
 * Mark a message as successfully processed
 */
export async function xdelo_markMessageAsProcessed(
  messageId: string,
  correlationId: string,
  metadata: Record<string, any> = {}
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from('messages')
      .update({
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        correlation_id: correlationId,
        processing_metadata: metadata
      })
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error marking message ${messageId} as processed:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception marking message ${messageId} as processed:`, error);
    return false;
  }
}

/**
 * Get a message by ID with error handling
 */
export async function xdelo_getMessage(messageId: string): Promise<any> {
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (error) {
      throw new Error(`Error fetching message ${messageId}: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Exception fetching message ${messageId}:`, error);
    throw error;
  }
}
