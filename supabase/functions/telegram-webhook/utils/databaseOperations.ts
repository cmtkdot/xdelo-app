
import { supabaseClient } from './supabase.ts';

/**
 * Log a processing event to the unified_audit_logs table
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string
) {
  try {
    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: correlationId,
      logged_from: 'edge_function'
    };
    
    const { error } = await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: correlationId,
      event_timestamp: new Date().toISOString()
    });
    
    if (error) {
      console.error(`Error logging event: ${eventType}`, error);
    }
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

/**
 * Process caption for a message directly from the webhook
 */
export async function xdelo_processCaptionFromWebhook(
  messageId: string,
  correlationId: string,
  force: boolean = false
) {
  try {
    console.log(`Processing caption for message ${messageId} with correlation ID ${correlationId}, force=${force}`);
    
    const { data, error } = await supabaseClient.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: messageId,
        p_correlation_id: correlationId,
        p_force: force
      }
    );
    
    if (error) {
      console.error('Error processing caption:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`Caption processing completed for message ${messageId}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception processing caption:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Sync media group content directly from the webhook
 */
export async function xdelo_syncMediaGroupFromWebhook(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  forceSync: boolean = false,
  syncEditHistory: boolean = true
) {
  try {
    if (!mediaGroupId) {
      return { success: false, error: 'No media_group_id provided' };
    }
    
    console.log(`Syncing media group ${mediaGroupId} from source message ${sourceMessageId}, correlation ID: ${correlationId}`);
    
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: correlationId,
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      }
    );
    
    if (error) {
      console.error('Error syncing media group:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`Media group sync completed for ${mediaGroupId}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception syncing media group:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Find caption message for a media group
 */
export async function xdelo_findCaptionMessage(mediaGroupId: string) {
  try {
    console.log(`Finding caption message for media group ${mediaGroupId}`);
    
    const { data, error } = await supabaseClient.rpc(
      'xdelo_find_caption_message',
      { p_media_group_id: mediaGroupId }
    );
    
    if (error) {
      console.error('Error finding caption message:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`Found caption message for media group ${mediaGroupId}:`, data);
    return { success: true, captionMessageId: data };
  } catch (error) {
    console.error('Exception finding caption message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Check if a message exists in the database
 */
export async function messageExists(telegramMessageId: number, chatId: number) {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('telegram_message_id', telegramMessageId)
      .eq('chat_id', chatId)
      .maybeSingle();
      
    if (error) {
      console.error('Error checking if message exists:', error);
      return { exists: false, error: error.message };
    }
    
    return { exists: !!data, messageId: data?.id };
  } catch (error) {
    console.error('Exception checking if message exists:', error);
    return { 
      exists: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
