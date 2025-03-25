
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Log a processing event to the unified_audit_logs table
 * Handles non-UUID entity IDs safely
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    // Prevent UUID conversion errors by ensuring entityId is not a simple number
    const safeEntityId = typeof entityId === 'number' || /^\d+$/.test(entityId) 
      ? `message_${entityId}` 
      : entityId;
    
    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: correlationId,
      logged_from: 'edge_function'
    };
    
    // Try using the RPC function that safely handles non-UUID values
    const { error: rpcError } = await supabaseClient.rpc(
      'xdelo_logprocessingevent',
      {
        p_event_type: eventType,
        p_entity_id: safeEntityId,
        p_correlation_id: correlationId,
        p_metadata: enhancedMetadata,
        p_error_message: errorMessage
      }
    );
    
    // Fall back to direct insert if RPC fails
    if (rpcError) {
      console.error(`RPC logging failed: ${rpcError.message}, trying direct insert`);
      
      // Try to clean up the entity ID to be UUID compatible
      let validEntityId = safeEntityId;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safeEntityId)) {
        // If not a valid UUID, generate one
        validEntityId = crypto.randomUUID();
        // Store the original ID in metadata
        enhancedMetadata.original_entity_id = safeEntityId;
      }
      
      const { error } = await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: validEntityId,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        correlation_id: correlationId,
        event_timestamp: new Date().toISOString()
      });
      
      if (error) {
        console.error(`Direct logging also failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

/**
 * Update message processing state
 */
export async function updateMessageState(
  messageId: string,
  state: 'pending' | 'processing' | 'completed' | 'error',
  errorMessage?: string
) {
  try {
    const updates: Record<string, unknown> = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };
    
    if (state === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    } else if (state === 'completed') {
      updates.processing_completed_at = new Date().toISOString();
      updates.error_message = null;
    } else if (state === 'error' && errorMessage) {
      updates.error_message = errorMessage;
      updates.last_error_at = new Date().toISOString();
    }
    
    const { error } = await supabaseClient
      .from('messages')
      .update(updates)
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error updating message state: ${error.message}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating message state: ${error.message}`);
    return false;
  }
}

/**
 * Get message by ID
 */
export async function getMessageById(messageId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (error) {
      console.error(`Error getting message: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Error getting message: ${error.message}`);
    return null;
  }
}
