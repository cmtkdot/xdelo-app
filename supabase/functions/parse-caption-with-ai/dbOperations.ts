
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
      p_error: errorMessage
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
    return { success: false };
  }
  
  try {
    // Use the sync function with clear parameters
    const { data, error } = await supabaseClient.rpc('xdelo_sync_media_group_content', {
      p_media_group_id: mediaGroupId,
      p_source_message_id: messageId
    });
    
    if (error) {
      console.error('Error syncing media group content:', error);
      return { success: false };
    }
    
    return { 
      success: true, 
      syncedCount: data, 
      source_message_id: messageId 
    };
  } catch (error) {
    console.error('Failed to sync media group content:', error);
    return { success: false };
  }
};

// Log the analysis in the audit logs
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
