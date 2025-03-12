// Shared database operations for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Create the client once
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Analyze a message caption using the database function with correct parameter order
 */
export async function xdelo_analyzeMessageCaption(
  messageId: string,
  correlationId: string,
  caption: string,
  mediaGroupId?: string,
  forceReprocess: boolean = false
) {
  try {
    // Check if the database function supports force_reprocess parameter
    if (forceReprocess) {
      try {
        // Try with force_reprocess parameter
        const { data, error } = await supabaseClient.rpc(
          'xdelo_analyze_message_caption',
          {
            p_message_id: messageId,
            p_correlation_id: correlationId,
            p_caption: caption,
            p_media_group_id: mediaGroupId,
            p_force_reprocess: forceReprocess
          }
        );
        
        if (!error) {
          return { success: true, data };
        }
        
        // If we get a specific error about parameter matching, fall back to version without force_reprocess
        if (error.message?.includes('Could not find the function') || 
            error.code === 'PGRST202') {
          console.warn('Database function does not support force_reprocess parameter, falling back to basic version');
          // Fall through to basic version
        } else {
          throw error; // Re-throw other errors
        }
      } catch (err) {
        // If this wasn't a parameter error, rethrow
        if (!err.message?.includes('Could not find the function') && 
            err.code !== 'PGRST202') {
          throw err;
        }
        console.warn('Error with force_reprocess parameter, falling back:', err.message);
        // Otherwise fall through to basic version
      }
    }
    
    // Basic version without force_reprocess
    const { data, error } = await supabaseClient.rpc(
      'xdelo_analyze_message_caption',
      {
        p_message_id: messageId,
        p_correlation_id: correlationId,
        p_caption: caption,
        p_media_group_id: mediaGroupId
      }
    );
    
    if (error) {
      throw error;
    }
    
    return { success: true, data };
  } catch (error) {
    console.error(`Error analyzing message caption (ID: ${messageId}):`, error);
    return { 
      success: false, 
      error: error.message || 'Unknown error analyzing caption',
      code: error.code
    };
  }
}

/**
 * Log a processing event to the unified_audit_logs table
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
) {
  try {
    const event = {
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      error_message: errorMessage,
      event_timestamp: new Date().toISOString()
    };
    
    const { error } = await supabaseClient
      .from('unified_audit_logs')
      .insert(event);
      
    if (error) {
      console.error(`Error logging event ${eventType}:`, error);
    }
    
    return { success: !error };
  } catch (error) {
    console.error(`Error in xdelo_logProcessingEvent:`, error);
    return { success: false };
  }
}

/**
 * Update message processing state
 */
export async function xdelo_updateMessageProcessingState(
  messageId: string,
  state: string,
  correlationId: string,
  errorMessage?: string
) {
  try {
    const updates: Record<string, any> = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };
    
    if (state === 'completed') {
      updates.processing_completed_at = new Date().toISOString();
    } else if (state === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    }
    
    if (errorMessage) {
      updates.error_message = errorMessage;
      updates.last_error_at = new Date().toISOString();
      updates.retry_count = supabaseClient.rpc('increment_retry_count', { 
        p_message_id: messageId 
      });
    }
    
    const { error } = await supabaseClient
      .from('messages')
      .update(updates)
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error updating message state:`, error);
      return { success: false, error: error.message };
    }
    
    // Log the state change
    await xdelo_logProcessingEvent(
      'message_state_changed',
      messageId,
      correlationId,
      { old_state: state === 'error' ? 'processing' : null, new_state: state },
      errorMessage
    );
    
    return { success: true };
  } catch (error) {
    console.error(`Error in xdelo_updateMessageProcessingState:`, error);
    return { success: false, error: error.message };
  }
}
