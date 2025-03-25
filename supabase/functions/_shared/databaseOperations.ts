
// Add exports for the required database operation functions
import { corsHeaders } from "./cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

/**
 * Process caption from webhook for a specific message
 */
export async function xdelo_processCaptionFromWebhook(
  messageId: string,
  correlationId?: string,
  force: boolean = false
): Promise<any> {
  try {
    // Get Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // Call the database function
    const { data, error } = await supabase.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: messageId,
        p_correlation_id: correlationId || uuidv4(),
        p_force: force
      }
    );
    
    if (error) {
      console.error(`Error processing caption: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message_id: messageId
      };
    }
    
    console.log(`Caption processing completed for message ${messageId}: ${JSON.stringify(data, null, 2)}`);
    
    return {
      success: true,
      message: "Caption processed successfully",
      data,
      message_id: messageId
    };
  } catch (error) {
    console.error(`Unexpected error processing caption: ${error.message}`);
    return {
      success: false,
      error: error.message,
      message_id: messageId
    };
  }
}

/**
 * Sync media group from webhook
 */
export async function xdelo_syncMediaGroupFromWebhook(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId?: string,
  forceSync: boolean = false,
  syncEditHistory: boolean = false
): Promise<any> {
  try {
    if (!mediaGroupId) {
      return {
        success: false,
        error: "No media group ID provided",
        source_message_id: sourceMessageId
      };
    }
    
    // Get Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // Call the database function
    const { data, error } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: correlationId || uuidv4(),
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      }
    );
    
    if (error) {
      console.error(`Error syncing media group: ${error.message}`);
      return {
        success: false,
        error: error.message,
        media_group_id: mediaGroupId,
        source_message_id: sourceMessageId
      };
    }
    
    console.log(`Media group sync completed for group ${mediaGroupId}: ${JSON.stringify(data, null, 2)}`);
    
    return {
      success: true,
      message: "Media group synced successfully",
      data,
      media_group_id: mediaGroupId,
      source_message_id: sourceMessageId
    };
  } catch (error) {
    console.error(`Unexpected error syncing media group: ${error.message}`);
    return {
      success: false,
      error: error.message,
      media_group_id: mediaGroupId,
      source_message_id: sourceMessageId
    };
  }
}

/**
 * Log processing events using the RPC function
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata?: any,
  errorMessage?: string
): Promise<void> {
  try {
    // Ensure correlationId is never undefined
    const safeCorrelationId = correlationId || uuidv4();
    
    // Ensure metadata has a timestamp and source
    const enhancedMetadata = {
      ...(metadata || {}),
      timestamp: new Date().toISOString(),
      logged_from: 'edge_function'
    };
    
    // Get Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // Use the RPC function to avoid direct insert
    const { error } = await supabase.rpc(
      'xdelo_logprocessingevent',
      { 
        p_event_type: eventType,
        p_entity_id: entityId,
        p_correlation_id: safeCorrelationId,
        p_metadata: enhancedMetadata,
        p_error_message: errorMessage
      }
    );
    
    if (error) {
      console.error(`Error logging processing event: ${error.message}`);
      
      // Fallback logging to console if database logging fails
      console.log(JSON.stringify({
        event_type: eventType,
        entity_id: entityId,
        correlation_id: safeCorrelationId,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      }, null, 2));
    }
  } catch (error) {
    console.error(`Failed to log processing event: ${error.message}`);
    
    // Log to console as fallback
    console.error(JSON.stringify({
      event_type: "log_failure",
      original_event_type: eventType,
      entity_id: entityId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}
