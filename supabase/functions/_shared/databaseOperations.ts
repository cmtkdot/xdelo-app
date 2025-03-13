
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

// Allowed event types for the unified_audit_logs table
type UnifiedEventType = 
  | "message_created"
  | "message_updated" 
  | "message_deleted"
  | "message_analyzed"
  | "processing_started"
  | "processing_completed"
  | "processing_error"
  | "processing_state_changed"
  | "media_group_synced"
  | "caption_synced"
  | "file_uploaded"
  | "file_deleted"
  | "storage_repaired"
  | "user_action"
  | "system_error"
  | "system_warning"
  | "system_info";

/**
 * Universal log function for edge functions
 */
export async function xdelo_logEvent(
  eventType: UnifiedEventType,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown> = {},
  errorMessage?: string,
  previousState?: Record<string, unknown>,
  newState?: Record<string, unknown>
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      error_message: errorMessage,
      correlation_id: correlationId,
      previous_state: previousState,
      new_state: newState,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

/**
 * Log a processing event to the unified_audit_logs table
 * @deprecated Use xdelo_logEvent instead
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
) {
  // Map old event types to new ones
  let mappedEventType: UnifiedEventType;
  if (eventType.includes('error')) {
    mappedEventType = 'processing_error';
  } else if (eventType.includes('completed')) {
    mappedEventType = 'processing_completed';
  } else if (eventType.includes('started')) {
    mappedEventType = 'processing_started';
  } else {
    mappedEventType = 'system_info';
  }

  await xdelo_logEvent(
    mappedEventType,
    entityId,
    correlationId,
    {
      ...metadata,
      legacy_event_type: eventType
    },
    errorMessage
  );
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
    
    // Log the state change
    await xdelo_logEvent(
      'processing_state_changed',
      messageId,
      crypto.randomUUID(),
      {
        new_state: state,
        error_message: errorMessage,
        updates
      }
    );
    
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
