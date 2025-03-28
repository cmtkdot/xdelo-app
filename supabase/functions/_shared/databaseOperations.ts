
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

/**
 * Set a message as processing
 */
export async function xdelo_setMessageProcessingState(
  messageId: string,
  correlationId: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from('messages')
      .update({
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error setting message ${messageId} as processing:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception setting message ${messageId} as processing:`, error);
    return false;
  }
}

/**
 * Log a webhook event
 */
export async function xdelo_logWebhookEvent(
  webhookType: string,
  payload: Record<string, any>,
  correlationId: string
): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        webhook_type: webhookType,
        payload: payload,
        correlation_id: correlationId,
        created_at: new Date().toISOString()
      });
      
    if (error) {
      console.error(`Error logging webhook event ${webhookType}:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception logging webhook event ${webhookType}:`, error);
    return false;
  }
}

/**
 * Get a batch of messages by their IDs
 */
export async function xdelo_getMessagesByIds(messageIds: string[]): Promise<any[]> {
  if (!messageIds.length) return [];
  
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .in('id', messageIds);
      
    if (error) {
      throw new Error(`Error fetching messages by IDs: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error(`Exception fetching messages by IDs:`, error);
    throw error;
  }
}

/**
 * Get messages by media group ID
 */
export async function xdelo_getMessagesByMediaGroupId(mediaGroupId: string): Promise<any[]> {
  try {
    const supabase = createSupabaseClient();
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });
      
    if (error) {
      throw new Error(`Error fetching messages by media group ID ${mediaGroupId}: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    console.error(`Exception fetching messages by media group ID ${mediaGroupId}:`, error);
    throw error;
  }
}

/**
 * Sync analyzed content across a media group
 */
export async function xdelo_syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string
): Promise<{ success: boolean; synced: number }> {
  try {
    const supabase = createSupabaseClient();
    
    // Get the source message
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select('analyzed_content, caption')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage) {
      throw new Error(`Error fetching source message: ${sourceError?.message || 'Message not found'}`);
    }
    
    // Get all messages in the group except the source
    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('id')
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId);
      
    if (groupError) {
      throw new Error(`Error fetching group messages: ${groupError.message}`);
    }
    
    if (!groupMessages || groupMessages.length === 0) {
      return { success: true, synced: 0 };
    }
    
    // Update all other messages in the group with the analyzed content from the source
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: sourceMessage.analyzed_content,
        caption: sourceMessage.caption,
        group_caption_synced: true,
        is_original_caption: false,
        updated_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .in('id', groupMessages.map(msg => msg.id));
      
    if (updateError) {
      throw new Error(`Error syncing group content: ${updateError.message}`);
    }
    
    // Mark source message as synced
    await supabase
      .from('messages')
      .update({
        group_caption_synced: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceMessageId);
      
    // Log the successful sync
    await xdelo_logProcessingEvent(
      'media_group_sync',
      mediaGroupId,
      correlationId,
      {
        source_message_id: sourceMessageId,
        synced_message_count: groupMessages.length
      }
    );
    
    return { success: true, synced: groupMessages.length };
  } catch (error) {
    console.error(`Exception syncing media group content for group ${mediaGroupId}:`, error);
    
    // Log the error
    await xdelo_logProcessingEvent(
      'media_group_sync_error',
      mediaGroupId,
      correlationId,
      {},
      error.message
    );
    
    throw error;
  }
}
