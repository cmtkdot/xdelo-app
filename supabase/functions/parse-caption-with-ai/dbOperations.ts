import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ParsedContent, MediaGroupResult } from './types.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Get message by ID with improved error handling
export const getMessage = async (messageId: string) => {
  try {
    console.log(`Getting message details for ID: ${messageId}`);
    const { data, error } = await supabaseClient
      .from('messages')
      .select('analyzed_content, old_analyzed_content, media_group_id, processing_state, is_original_caption, caption')
      .eq('id', messageId)
      .single();

    if (error) {
      throw new Error(`Failed to retrieve message: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error in getMessage: ${error.message}`);
    throw error; // Re-throw to be handled by caller
  }
};

// Update message with analyzed content with improved handling for edits
export const updateMessageWithAnalysis = async (
  messageId: string,
  analyzedContent: ParsedContent,
  existingMessage: any,
  queueId?: string,
  isEdit?: boolean
) => {
  try {
    console.log(`Updating message ${messageId} with analyzed content, isEdit: ${isEdit}`);
    
    // If we have a queue ID and the old function still exists, try to use it
    if (queueId) {
      console.log(`Attempting to use queue completion function for queue ID: ${queueId}`);
      try {
        const { error } = await supabaseClient.rpc('xdelo_complete_message_processing', {
          p_queue_id: queueId,
          p_analyzed_content: analyzedContent,
          p_is_edit: isEdit || false
        });
        
        if (error) {
          throw new Error(`Queue completion failed: ${error.message}`);
        }
      } catch (queueError) {
        console.error(`Queue completion error: ${queueError.message}`);
        // Fall back to direct update if queue completion fails
        console.log(`Falling back to direct update for message ${messageId}`);
        return await directUpdateMessage(messageId, analyzedContent, existingMessage, isEdit);
      }
      
      return { success: true };
    } 
    
    // Otherwise, update the message directly
    return await directUpdateMessage(messageId, analyzedContent, existingMessage, isEdit);
  } catch (error) {
    console.error(`Error in updateMessageWithAnalysis: ${error.message}`);
    throw error; // Re-throw to be handled by caller
  }
};

// Helper function for direct message updates
async function directUpdateMessage(
  messageId: string,
  analyzedContent: ParsedContent,
  existingMessage: any,
  isEdit?: boolean
) {
  // Prepare old_analyzed_content array
  let oldAnalyzedContent = [];
  
  if (existingMessage?.old_analyzed_content) {
    oldAnalyzedContent = Array.isArray(existingMessage.old_analyzed_content) ? 
      [...existingMessage.old_analyzed_content] : 
      [existingMessage.old_analyzed_content];
  }
  
  if (existingMessage?.analyzed_content && isEdit) {
    // Add edit timestamp to the previous content
    const previousContent = {
      ...existingMessage.analyzed_content,
      edit_timestamp: new Date().toISOString()
    };
    oldAnalyzedContent.push(previousContent);
  }
  
  // Set is_original_caption based on current state and whether this is an edit
  let isOriginalCaption = true;
  if (isEdit) {
    // For edits, keep original caption status if it already exists
    isOriginalCaption = existingMessage?.is_original_caption !== false;
  }
  
  // Update data with explicit log
  console.log(`Directly updating message ${messageId}, setting is_original_caption: ${isOriginalCaption}`);
  
  const updateData = {
    old_analyzed_content: oldAnalyzedContent,
    analyzed_content: analyzedContent,
    processing_state: 'completed',
    processing_completed_at: new Date().toISOString(),
    is_original_caption: isOriginalCaption,
    group_caption_synced: false // Reset to false to trigger re-sync
  };

  const { error } = await supabaseClient
    .from('messages')
    .update(updateData)
    .eq('id', messageId);

  if (error) {
    throw new Error(`Direct message update failed: ${error.message}`);
  }
  
  return { success: true };
}

// Mark queue processing as failed - keep for backward compatibility
export const markQueueItemAsFailed = async (queueId: string, errorMessage: string) => {
  if (!queueId) return { success: false };
  
  try {
    // First try the direct message update approach
    const { data: message } = await supabaseClient
      .from('message_processing_queue')
      .select('message_id')
      .eq('id', queueId)
      .single();
    
    if (message?.message_id) {
      // Update the message directly
      await supabaseClient
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: errorMessage,
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.message_id);
      
      return { success: true };
    }
    
    // Fall back to the old function if it still exists
    try {
      const { error } = await supabaseClient.rpc('xdelo_fail_message_processing', {
        p_queue_id: queueId,
        p_error_message: errorMessage
      });
      
      if (error) {
        return { success: false, error: error.message };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error marking queue item as failed:', error);
      return { success: false, error: error.message };
    }
  } catch (error) {
    console.error('Error in markQueueItemAsFailed:', error);
    return { success: false, error: error.message };
  }
};

// Sync analyzed content to media group with improved error handling
export const syncMediaGroupContent = async (
  mediaGroupId: string | null | undefined,
  messageId: string,
  correlationId?: string,
  isEdit: boolean = false
): Promise<MediaGroupResult> => {
  if (!mediaGroupId) {
    return { success: false, reason: 'no_media_group_id' };
  }
  
  try {
    console.log(`Starting media group sync for group ${mediaGroupId} from message ${messageId}, isEdit: ${isEdit}`);
    
    // First check if the message is still eligible to be a source message
    const { data: sourceMessage } = await supabaseClient
      .from('messages')
      .select('analyzed_content, caption, is_original_caption')
      .eq('id', messageId)
      .single();
    
    if (!sourceMessage?.analyzed_content || !sourceMessage?.caption) {
      console.log(`Message ${messageId} is not eligible as a source message (no analyzed_content or caption)`);
      return { success: false, reason: 'source_not_eligible' };
    }
    
    // Log the sync attempt - use string correlation ID, not UUID
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_sync_requested',
      entity_id: messageId,
      metadata: {
        media_group_id: mediaGroupId,
        source_message_id: messageId,
        method: 'from_caption_analysis',
        is_edit: isEdit
      },
      correlation_id: correlationId || null
    });

    // Call the edge function for better handling
    try {
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            mediaGroupId,
            sourceMessageId: messageId,
            correlationId,
            forceSync: true,
            syncEditHistory: isEdit
          })
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync function error: ${errorText}`);
      }
      
      const result = await response.json();
      
      return { 
        success: true, 
        syncedCount: result.data.updated_count, 
        source_message_id: messageId,
        method: 'edge_function',
        details: result.data
      };
    } catch (edgeFunctionError) {
      console.error('Error calling sync edge function, falling back to direct method:', edgeFunctionError);
      
      // Fall back to direct SQL function call
      const { data: syncResult, error: syncError } = await supabaseClient.rpc(
        'xdelo_sync_media_group_content',
        {
          p_source_message_id: messageId,
          p_media_group_id: mediaGroupId,
          p_correlation_id: correlationId,
          p_force_sync: true,
          p_sync_edit_history: isEdit
        }
      );
      
      if (syncError) {
        throw new Error(`Direct sync failed: ${syncError.message}`);
      }
      
      return { 
        success: true, 
        syncedCount: syncResult.updated_count, 
        source_message_id: messageId,
        method: 'direct_rpc',
        details: syncResult
      };
    }
  } catch (error) {
    console.error('Failed to sync media group content:', error);
    
    // Log the error
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_sync_error',
      entity_id: messageId,
      error_message: error.message,
      metadata: {
        media_group_id: mediaGroupId,
        method: 'sync_attempt_failed',
        is_edit: isEdit
      },
      correlation_id: correlationId || null
    });
    
    return {
      success: false,
      error: error.message,
      reason: 'sync_error'
    };
  }
};

// Log analysis events
export const logAnalysisEvent = async (
  messageId: string,
  correlationId: string | null,
  previousState: any,
  newState: any,
  metadata: any
) => {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'caption_analysis_completed',
      entity_id: messageId,
      correlation_id: correlationId,
      previous_state: previousState,
      new_state: newState,
      metadata,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log analysis event:', error);
  }
};
