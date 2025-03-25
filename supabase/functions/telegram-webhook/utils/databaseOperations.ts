
import { supabaseClient } from './supabase.ts';
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

/**
 * Log a processing event for auditing and debugging
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any>,
  errorMessage?: string
) {
  try {
    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: new Date().toISOString(),
      logged_from: 'telegram_webhook'
    };
    
    // Use the database function to log the event
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
      console.error('Error logging processing event:', error);
    }
  } catch (err) {
    console.error('Exception logging processing event:', err);
  }
}

/**
 * Process delayed media group synchronization
 * This function is called after a timeout to ensure all media in a group has arrived
 */
export async function xdelo_processDelayedMediaGroupSync(
  mediaGroupId: string,
  correlationId: string
) {
  try {
    if (!mediaGroupId) {
      console.error('No media group ID provided for delayed sync');
      return { success: false, error: 'No media group ID provided' };
    }
    
    // Log the start of the delayed sync
    await xdelo_logProcessingEvent(
      'delayed_media_group_sync_start',
      mediaGroupId,
      correlationId,
      { mediaGroupId, timestamp: new Date().toISOString() }
    );
    
    // First, find the best message to use as the source of truth for the caption
    const { data: captionMessageId, error: findError } = await supabaseClient.rpc(
      'xdelo_find_caption_message',
      { p_media_group_id: mediaGroupId }
    );
    
    if (findError) {
      console.error('Error finding caption message:', findError);
      await xdelo_logProcessingEvent(
        'delayed_media_group_sync_error',
        mediaGroupId,
        correlationId,
        { error: findError.message },
        findError.message
      );
      return { success: false, error: findError.message };
    }
    
    if (!captionMessageId) {
      console.warn(`No suitable caption message found for group ${mediaGroupId}`);
      await xdelo_logProcessingEvent(
        'delayed_media_group_sync_warning',
        mediaGroupId,
        correlationId,
        { warning: 'No suitable caption message found' }
      );
      return { success: false, error: 'No suitable caption message found' };
    }
    
    // Now sync the media group using the found caption message
    const { data: syncResult, error: syncError } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: captionMessageId,
        p_correlation_id: correlationId,
        p_force_sync: true
      }
    );
    
    if (syncError) {
      console.error('Error in delayed media group sync:', syncError);
      await xdelo_logProcessingEvent(
        'delayed_media_group_sync_error',
        mediaGroupId,
        correlationId,
        { error: syncError.message },
        syncError.message
      );
      return { success: false, error: syncError.message };
    }
    
    // Log the successful completion
    await xdelo_logProcessingEvent(
      'delayed_media_group_sync_complete',
      mediaGroupId,
      correlationId,
      { 
        captionMessageId,
        result: syncResult,
        timestamp: new Date().toISOString()
      }
    );
    
    return { 
      success: true, 
      captionMessageId,
      syncResult
    };
  } catch (error) {
    console.error('Exception in delayed media group sync:', error);
    
    await xdelo_logProcessingEvent(
      'delayed_media_group_sync_exception',
      mediaGroupId,
      correlationId,
      { error: error.message },
      error.message
    );
    
    return { 
      success: false, 
      error: error.message || 'Unknown error in delayed sync'
    };
  }
}
