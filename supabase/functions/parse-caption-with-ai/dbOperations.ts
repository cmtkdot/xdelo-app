
import { supabaseClient } from '../_shared/supabase.ts';
import { ParsedContent } from './types.ts';

export async function getMessage(messageId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(`Error getting message ${messageId}:`, error);
    throw error;
  }
}

export async function updateMessageWithAnalysis(
  messageId: string, 
  parsedContent: ParsedContent, 
  existingMessage: any, 
  queueId?: string,
  isEdit = false
) {
  try {
    // Determine the correct processing state based on partial success
    let processingState = 'completed';
    
    // If partially successful (missing critical fields), mark as partial_success instead
    if (parsedContent.parsing_metadata.partial_success) {
      processingState = 'partial_success';
      console.log(`Message ${messageId} marked as partial_success due to missing fields:`, 
        parsedContent.parsing_metadata.missing_fields);
    }
    
    const updateData: any = {
      analyzed_content: parsedContent,
      processing_state: processingState,
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // For edits, store old content as history
    if (isEdit && existingMessage?.analyzed_content) {
      const oldContent = existingMessage.old_analyzed_content || [];
      const updatedHistory = [...oldContent, existingMessage.analyzed_content];
      updateData.old_analyzed_content = updatedHistory;
    }
    
    // If this is part of a media group, mark as original caption
    if (existingMessage?.media_group_id) {
      updateData.is_original_caption = true;
      updateData.group_caption_synced = true;
    }
    
    // Use the supabase function to update the message in a transaction
    const { data, error } = await supabaseClient.rpc(
      'xdelo_update_message_with_analyzed_content',
      {
        p_message_id: messageId,
        p_analyzed_content: parsedContent,
        p_processing_state: processingState,
        p_is_edit: isEdit
      }
    );
    
    if (error) {
      console.error('Transaction update failed, falling back to direct update', error);
      
      // Fallback to direct update if transaction fails
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', messageId);
      
      if (updateError) throw updateError;
    }
    
    // If queue ID is provided, update the queue item
    if (queueId) {
      await completeQueueItem(queueId);
    }
    
    return {
      success: true,
      message: `Message ${messageId} analyzed successfully`,
      processing_state: processingState,
      partial_success: parsedContent.parsing_metadata.partial_success
    };
  } catch (error) {
    console.error(`Error updating message ${messageId} with analysis:`, error);
    throw error;
  }
}

export async function markQueueItemAsFailed(queueId: string, errorMessage: string) {
  if (!queueId) return;
  
  try {
    await supabaseClient
      .from('processing_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId);
  } catch (error) {
    console.error(`Error marking queue item ${queueId} as failed:`, error);
  }
}

export async function completeQueueItem(queueId: string) {
  if (!queueId) return;
  
  try {
    await supabaseClient
      .from('processing_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId);
  } catch (error) {
    console.error(`Error completing queue item ${queueId}:`, error);
  }
}

export async function syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  syncEditHistory = false
) {
  if (!mediaGroupId) return null;
  
  try {
    // First try using the database function with transaction support
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: true,
        p_sync_edit_history: syncEditHistory
      }
    );
    
    if (error) {
      console.error('Media group sync through DB function failed:', error);
      throw error;
    }
    
    return data;
  } catch (dbError) {
    console.warn(`DB media group sync failed, falling back to direct sync: ${dbError.message}`);
    
    try {
      // Get analyzed content from source message
      const { data: sourceMessage } = await supabaseClient
        .from('messages')
        .select('analyzed_content, old_analyzed_content')
        .eq('id', sourceMessageId)
        .single();
      
      if (!sourceMessage?.analyzed_content) {
        throw new Error('Source message has no analyzed content');
      }
      
      // Mark source message as original caption
      await supabaseClient
        .from('messages')
        .update({
          is_original_caption: true,
          group_caption_synced: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', sourceMessageId);
      
      // Update all other messages in the group
      const updateData: any = {
        analyzed_content: sourceMessage.analyzed_content,
        message_caption_id: sourceMessageId,
        is_original_caption: false,
        group_caption_synced: true,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (syncEditHistory && sourceMessage.old_analyzed_content) {
        updateData.old_analyzed_content = sourceMessage.old_analyzed_content;
      }
      
      const { data: updateResult, error: updateError } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('media_group_id', mediaGroupId)
        .neq('id', sourceMessageId);
      
      if (updateError) throw updateError;
      
      // Log the fallback sync
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'media_group_sync_fallback',
        entity_id: sourceMessageId,
        correlation_id: correlationId,
        metadata: {
          media_group_id: mediaGroupId,
          sync_edit_history: syncEditHistory,
          sync_method: 'direct_fallback',
          original_error: dbError.message
        },
        event_timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        media_group_id: mediaGroupId,
        sync_method: 'fallback',
        source_message_id: sourceMessageId
      };
    } catch (fallbackError) {
      console.error('Fallback sync also failed:', fallbackError);
      
      // Log both errors
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'media_group_sync_error',
        entity_id: sourceMessageId,
        error_message: `Original error: ${dbError.message}, Fallback error: ${fallbackError.message}`,
        correlation_id: correlationId,
        metadata: {
          media_group_id: mediaGroupId,
          sync_edit_history: syncEditHistory,
          sync_method: 'both_failed'
        },
        event_timestamp: new Date().toISOString()
      });
      
      throw new Error(`Media group sync failed after multiple attempts: ${fallbackError.message}`);
    }
  }
}

export async function logAnalysisEvent(
  messageId: string,
  correlationId: string,
  previousState: any,
  newState: any,
  metadata: any
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'caption_analysis',
      entity_id: messageId,
      correlation_id: correlationId,
      previous_state: previousState,
      new_state: newState,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging analysis event:', error);
  }
}
