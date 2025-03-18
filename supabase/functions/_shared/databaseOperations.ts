
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Initialize Supabase client (lazily to avoid unnecessary instantiation)
let _supabaseClient: any = null;

/**
 * Get a singleton Supabase client instance
 */
export function getSupabaseClient() {
  if (!_supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    
    _supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return _supabaseClient;
}

/**
 * Log a processing event to the unified audit logs
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        correlation_id: correlationId,
        metadata: {
          ...metadata,
          logged_at: new Date().toISOString()
        },
        error_message: errorMessage,
        event_timestamp: new Date().toISOString()
      });
  } catch (error) {
    // Don't throw errors from logging functions - just log to console
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to log processing event',
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

/**
 * Update the processing state of a message
 */
export async function xdelo_updateMessageProcessingState(
  messageId: string,
  status: 'pending' | 'processing' | 'completed' | 'error',
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const updates: Record<string, any> = {
      processing_state: status,
      updated_at: new Date().toISOString()
    };
    
    if (status === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updates.processing_completed_at = new Date().toISOString();
    } else if (status === 'error') {
      updates.error_message = errorMessage || 'Unknown error';
    }
    
    await supabase
      .from('messages')
      .update(updates)
      .eq('id', messageId);
  } catch (error) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message: 'Failed to update message processing state',
      message_id: messageId,
      status,
      error: error.message,
      timestamp: new Date().toISOString()
    }));
    throw error;
  }
}
