
import { supabaseClient } from "./supabase.ts";

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
    
    // Use the RPC function instead of direct table insert to handle non-UUID entity IDs
    const { error } = await supabaseClient.rpc(
      'xdelo_logprocessingevent',
      { 
        p_event_type: eventType,
        p_entity_id: entityId,
        p_correlation_id: correlationId,
        p_metadata: enhancedMetadata,
        p_error_message: errorMessage
      }
    );
    
    if (error) {
      console.error(`Error logging event: ${eventType}`, error);
    }
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

/**
 * Process caption using the unified processor
 */
export async function xdelo_processCaptionFromWebhook(
  messageId: string,
  correlationId: string,
  force: boolean = false
) {
  try {
    console.log(`Processing caption for message ${messageId} with correlation ID ${correlationId}, force=${force}`);
    
    // Use the unified processor for consistent caption processing
    const { data, error } = await supabaseClient.functions.invoke('xdelo_unified_processor', {
      body: {
        operation: 'process_caption',
        messageId: messageId,
        correlationId: correlationId,
        force: force
      }
    });
    
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
 * Sync media group content using the unified processor
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
    
    // Use the unified processor for consistent media group sync
    const { data, error } = await supabaseClient.functions.invoke('xdelo_unified_processor', {
      body: {
        operation: 'sync_media_group',
        messageId: sourceMessageId,
        mediaGroupId: mediaGroupId,
        correlationId: correlationId,
        force: forceSync
      }
    });
    
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
 * Process delayed media group sync using the unified processor
 */
export async function xdelo_processDelayedMediaGroupSync(
  mediaGroupId: string,
  correlationId: string
) {
  try {
    console.log(`Processing delayed sync for media group ${mediaGroupId}`);
    
    // Use the unified processor for delayed media group sync
    const { data, error } = await supabaseClient.functions.invoke('xdelo_unified_processor', {
      body: {
        operation: 'delayed_sync',
        messageId: 'auto-find', // This is a placeholder, will be determined by the processor
        mediaGroupId: mediaGroupId,
        correlationId: correlationId
      }
    });
    
    if (error) {
      console.error('Error processing delayed media group sync:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`Delayed media group sync completed for ${mediaGroupId}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception processing delayed media group sync:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Reprocess a message completely using the unified processor
 */
export async function xdelo_reprocessMessage(
  messageId: string,
  correlationId: string,
  force: boolean = true
) {
  try {
    console.log(`Reprocessing message ${messageId} with correlation ID ${correlationId}`);
    
    // Use the unified processor for consistent message reprocessing
    const { data, error } = await supabaseClient.functions.invoke('xdelo_unified_processor', {
      body: {
        operation: 'reprocess',
        messageId: messageId,
        correlationId: correlationId,
        force: force
      }
    });
    
    if (error) {
      console.error('Error reprocessing message:', error);
      return { success: false, error: error.message };
    }
    
    console.log(`Message reprocessing completed for ${messageId}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error('Exception reprocessing message:', error);
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
