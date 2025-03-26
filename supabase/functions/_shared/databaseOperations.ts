
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { xdelo_withDatabaseRetry } from './retryUtils.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

/**
 * Log a processing event to the unified_audit_logs table with retry logic
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string | number,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
) {
  try {
    // Ensure entityId is always a string and a valid UUID if possible
    const entityIdStr = String(entityId);
    
    // Enhance metadata for system events that don't have a valid UUID
    let enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: correlationId,
      logged_from: 'edge_function'
    };
    
    // For system events or other non-UUID entityIds, use a generated UUID and include original in metadata
    let actualEntityId = entityIdStr;
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!UUID_REGEX.test(entityIdStr)) {
      actualEntityId = crypto.randomUUID();
      enhancedMetadata = {
        ...enhancedMetadata,
        original_entity_id: entityIdStr,
        entity_type: entityIdStr === 'system' ? 'system' : 'unknown'
      };
      console.log(`Using generated UUID for non-UUID entity ID: ${entityIdStr} -> ${actualEntityId}`);
    }
    
    await xdelo_withDatabaseRetry(`log_processing_event_${eventType}`, async () => {
      const { error } = await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: actualEntityId,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        correlation_id: correlationId,
        event_timestamp: new Date().toISOString()
      });
      
      if (error) throw error;
    });
  } catch (error) {
    // Never throw from logging function - just log the error to console
    console.error(`Error logging event: ${eventType}`, error);
  }
}

/**
 * Update message processing state with retry logic
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
    
    return await xdelo_withDatabaseRetry(`update_message_state_${state}`, async () => {
      const { error } = await supabaseClient
        .from('messages')
        .update(updates)
        .eq('id', messageId);
        
      if (error) {
        console.error(`Error updating message state: ${error.message}`);
        return false;
      }
      
      return true;
    });
  } catch (error) {
    console.error(`Error updating message state: ${error.message}`);
    return false;
  }
}

/**
 * Get message by ID with retry logic
 */
export async function getMessageById(messageId: string) {
  try {
    return await xdelo_withDatabaseRetry(`get_message_by_id_${messageId}`, async () => {
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
    });
  } catch (error) {
    console.error(`Error getting message: ${error.message}`);
    return null;
  }
}

/**
 * Generic database operation with retry logic
 */
export async function xdelo_executeDbOperation<T>(
  operationName: string,
  operation: () => Promise<{ data?: T, error?: any }>,
  options: { maxRetries?: number; logError?: boolean } = {}
): Promise<{ success: boolean; data?: T; error?: any }> {
  const { maxRetries = 3, logError = true } = options;
  
  try {
    const result = await xdelo_withDatabaseRetry(operationName, async () => {
      const { data, error } = await operation();
      if (error) throw error;
      return data;
    }, { maxRetries });
    
    return { success: true, data: result };
  } catch (error) {
    if (logError) {
      console.error(`Database operation "${operationName}" failed after ${maxRetries} retries:`, error);
    }
    
    return { 
      success: false, 
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }
    };
  }
}
