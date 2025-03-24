
// Shared database operations for edge functions
import { createSupabaseClient } from "./supabase.ts";

/**
 * Log a processing event to the audit log
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
) {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation ID is a string
    const corrId = correlationId?.toString() || crypto.randomUUID().toString();
    
    const { error } = await supabase.from("unified_audit_logs").insert({
      event_type: eventType,
      entity_id: entityId.toString(),
      correlation_id: corrId,
      metadata: metadata,
      error_message: errorMessage
    });
    
    if (error) {
      console.error(`Error logging event: ${error.message}`, { eventType, entityId });
    }
  } catch (e) {
    console.error(`Exception in logProcessingEvent: ${e.message}`);
  }
}

/**
 * Process a message caption by calling the direct caption processor edge function
 */
export async function xdelo_processMessageCaption(
  messageId: string,
  caption?: string,
  correlationId?: string,
  isEdit: boolean = false
) {
  try {
    // Create a new correlation ID if one wasn't provided
    const corrId = correlationId?.toString() || crypto.randomUUID().toString();
    
    // Call the direct-caption-processor edge function
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/direct-caption-processor`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify({
        messageId,
        caption,
        correlationId: corrId,
        isEdit
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function error: ${errorText || response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error processing caption for message ${messageId}: ${error.message}`);
    
    // Log the error
    await xdelo_logProcessingEvent(
      "caption_processing_failed",
      messageId,
      correlationId || crypto.randomUUID().toString(),
      { error: error.message },
      error.message
    );
    
    throw error;
  }
}

/**
 * Sync analyzed content across all messages in a media group
 */
export async function xdelo_syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string
) {
  try {
    const supabase = createSupabaseClient();
    
    // Ensure correlation ID is a string
    const corrId = correlationId?.toString() || crypto.randomUUID().toString();
    
    const { data, error } = await supabase.rpc(
      "xdelo_sync_media_group_content",
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: corrId,
        p_force_sync: true,
        p_sync_edit_history: false
      }
    );
    
    if (error) {
      throw new Error(`Failed to sync media group: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error syncing media group: ${error.message}`);
    throw error;
  }
}
