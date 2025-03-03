
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ParsedContent, MediaGroupResult } from './types.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get message by ID
export const getMessage = async (messageId: string) => {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('analyzed_content, old_analyzed_content, media_group_id')
    .eq('id', messageId)
    .single();

  if (error) {
    throw new Error(`Failed to retrieve message: ${error.message}`);
  }
  
  return data;
};

// Update message with analyzed content
export const updateMessageWithAnalysis = async (
  messageId: string,
  analyzedContent: ParsedContent,
  existingMessage: any,
  queueId?: string
) => {
  // If we have a queue ID, use the complete processing function
  if (queueId) {
    const { error } = await supabaseClient.rpc('xdelo_complete_message_processing', {
      p_queue_id: queueId,
      p_analyzed_content: analyzedContent
    });
    
    if (error) {
      throw new Error(`Failed to complete message processing: ${error.message}`);
    }
    
    return { success: true };
  } 
  
  // Otherwise, update the message directly
  const updateData = {
    old_analyzed_content: existingMessage?.analyzed_content 
      ? [...(existingMessage.old_analyzed_content || []), existingMessage.analyzed_content]
      : existingMessage?.old_analyzed_content,
    analyzed_content: analyzedContent,
    processing_state: 'completed',
    processing_completed_at: new Date().toISOString(),
    is_original_caption: true // Mark as original caption holder
  };

  const { error } = await supabaseClient
    .from('messages')
    .update(updateData)
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to update message: ${error.message}`);
  }
  
  return { success: true };
};

// Mark queue processing as failed
export const markQueueItemAsFailed = async (queueId: string, errorMessage: string) => {
  if (!queueId) return { success: false };
  
  try {
    const { error } = await supabaseClient.rpc('xdelo_fail_message_processing', {
      p_queue_id: queueId,
      p_error_message: errorMessage
    });
    
    if (error) {
      console.error('Error marking queue item as failed:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in markQueueItemAsFailed:', error);
    return { success: false, error: error.message };
  }
};

// Sync analyzed content to media group
export const syncMediaGroupContent = async (
  mediaGroupId: string | null | undefined,
  messageId: string
): Promise<MediaGroupResult> => {
  if (!mediaGroupId) {
    return { success: false, reason: 'no_media_group_id' };
  }
  
  try {
    console.log(`Starting media group sync for group ${mediaGroupId} from message ${messageId}`);
    
    // Log the sync attempt
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_sync_requested',
      entity_id: messageId,
      metadata: {
        media_group_id: mediaGroupId,
        source_message_id: messageId,
        method: 'direct_call'
      }
    });

    // Try to use the RPC function first
    const { data, error } = await supabaseClient.rpc('xdelo_sync_media_group_content', {
      p_media_group_id: mediaGroupId,
      p_source_message_id: messageId
    });
    
    if (error) {
      console.error('Error calling xdelo_sync_media_group_content RPC:', error);
      console.log('Falling back to direct sync method');
      
      // Fallback to direct updates if RPC fails
      const syncResult = await syncMediaGroupDirectly(mediaGroupId, messageId);
      return { 
        success: true, 
        syncedCount: syncResult.count, 
        source_message_id: messageId,
        method: 'fallback_direct',
        details: syncResult
      };
    }
    
    console.log(`Successfully synced media group via RPC. Result:`, data);
    return { 
      success: true, 
      syncedCount: data, 
      source_message_id: messageId,
      method: 'rpc'
    };
  } catch (error) {
    console.error('Failed to sync media group content:', error);
    
    // Try fallback method
    try {
      const syncResult = await syncMediaGroupDirectly(mediaGroupId, messageId);
      return { 
        success: true, 
        syncedCount: syncResult.count, 
        source_message_id: messageId,
        method: 'error_fallback_direct',
        details: syncResult
      };
    } catch (fallbackError) {
      console.error('Both sync methods failed:', fallbackError);
      return {
        success: false,
        reason: 'all_methods_failed',
        error: error.message,
        fallbackError: fallbackError.message
      };
    }
  }
};

// Fallback method to sync media group directly if RPC fails
async function syncMediaGroupDirectly(mediaGroupId: string, sourceMessageId: string) {
  try {
    console.log(`Direct sync: Getting source message ${sourceMessageId}`);
    
    // Get the analyzed content from the source message
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('analyzed_content')
      .eq('id', sourceMessageId)
      .single();
    
    if (sourceError || !sourceMessage?.analyzed_content) {
      console.error('Source message has no analyzed_content:', sourceError);
      return { success: false, count: 0, error: sourceError?.message || 'No analyzed content' };
    }
    
    // Mark this message as the original caption holder
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        is_original_caption: true,
        group_caption_synced: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceMessageId);
      
    if (updateError) {
      console.error('Error updating source message:', updateError);
    }
    
    console.log(`Direct sync: Getting other messages in group ${mediaGroupId}`);
    
    // Get all other messages in the group
    const { data: groupMessages, error: groupError } = await supabaseClient
      .from('messages')
      .select('id, analyzed_content')
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId);
    
    if (groupError) {
      console.error('Error fetching group messages:', groupError);
      return { success: false, count: 0, error: groupError.message };
    }
    
    if (!groupMessages?.length) {
      console.log('No other messages in the group to sync');
      return { success: true, count: 0, message: 'No other messages to sync' };
    }
    
    console.log(`Direct sync: Updating ${groupMessages.length} other messages`);
    
    // Update all other messages in the group
    const updateResults = [];
    for (const message of groupMessages) {
      try {
        const { error: msgUpdateError } = await supabaseClient
          .from('messages')
          .update({
            analyzed_content: sourceMessage.analyzed_content,
            message_caption_id: sourceMessageId,
            is_original_caption: false,
            group_caption_synced: true,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', message.id);
          
        updateResults.push({
          id: message.id,
          success: !msgUpdateError,
          error: msgUpdateError?.message
        });
        
        if (msgUpdateError) {
          console.error(`Error updating message ${message.id}:`, msgUpdateError);
        }
      } catch (updateError) {
        console.error(`Exception updating message ${message.id}:`, updateError);
        updateResults.push({
          id: message.id,
          success: false,
          error: updateError.message
        });
      }
    }
    
    const successfulUpdates = updateResults.filter(r => r.success).length;
    console.log(`Direct sync: Successfully updated ${successfulUpdates} of ${groupMessages.length} messages`);
    
    return { 
      success: true, 
      count: successfulUpdates,
      total: groupMessages.length,
      results: updateResults
    };
  } catch (error) {
    console.error('Error in syncMediaGroupDirectly:', error);
    return { success: false, count: 0, error: error.message };
  }
}

// Log the analysis event
export const logAnalysisEvent = async (
  messageId: string,
  correlationId: string,
  previousState: any,
  newState: any,
  metadata: any
) => {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'caption_analyzed',
      entity_id: messageId,
      previous_state: previousState,
      new_state: newState,
      metadata: {
        ...metadata,
        correlation_id: correlationId
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging analysis event:', error);
    return { success: false, error: error.message };
  }
};
