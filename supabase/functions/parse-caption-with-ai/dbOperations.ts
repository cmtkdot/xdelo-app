
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ParsedContent, MediaGroupResult } from './types.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Update message with analyzed content with proper queue tracking
export const updateMessageWithAnalyzedContent = async (
  messageId: string,
  analyzedContent: ParsedContent,
  correlationId: string, 
  queueId?: string
) => {
  try {
    console.log(`Updating message ${messageId} with analyzed content`);
    
    // Get current message state first
    const { data: message, error: getError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, old_analyzed_content, is_original_caption')
      .eq('id', messageId)
      .single();
    
    if (getError) {
      console.error(`Error getting message ${messageId}:`, getError);
      return { success: false, error: getError.message };
    }
    
    // Prepare old_analyzed_content array for version history
    let oldAnalyzedContent = [];
    if (message?.old_analyzed_content) {
      oldAnalyzedContent = [...message.old_analyzed_content];
    }
    
    if (message?.analyzed_content) {
      oldAnalyzedContent.push({
        ...message.analyzed_content,
        archived_at: new Date().toISOString()
      });
    }
    
    // If we have a queue ID, use queue completion function
    if (queueId) {
      console.log(`Using queue completion for queue ID ${queueId}`);
      try {
        const { error: queueError } = await supabaseClient.rpc('xdelo_complete_message_processing', {
          p_queue_id: queueId,
          p_analyzed_content: analyzedContent
        });
        
        if (queueError) {
          throw new Error(`Queue completion failed: ${queueError.message}`);
        }
        
        // Log success
        await logAnalysisEvent(messageId, correlationId, message?.analyzed_content, analyzedContent, {
          method: 'queue_completion',
          queue_id: queueId
        });
        
        return { success: true };
      } catch (queueError) {
        console.error(`Queue completion error: ${queueError.message}`);
        // Fall back to direct update
      }
    }
    
    // Direct update if queue completion fails or no queue ID
    const updateData = {
      old_analyzed_content: oldAnalyzedContent,
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      is_original_caption: message?.is_original_caption !== false, // Preserve existing value or default to true
      group_caption_synced: false // Reset to trigger sync
    };
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update(updateData)
      .eq('id', messageId);
    
    if (updateError) {
      console.error(`Error updating message ${messageId}:`, updateError);
      return { success: false, error: updateError.message };
    }
    
    // Log the successful analysis
    await logAnalysisEvent(messageId, correlationId, message?.analyzed_content, analyzedContent, {
      method: 'direct_update'
    });
    
    return { success: true };
  } catch (error) {
    console.error(`Error in updateMessageWithAnalyzedContent: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Sync media group content
export const syncMediaGroup = async (
  messageId: string,
  mediaGroupId: string,
  correlationId: string
): Promise<MediaGroupResult> => {
  if (!mediaGroupId) {
    return { success: false, reason: 'no_media_group_id' };
  }
  
  try {
    console.log(`Syncing analyzed content to media group ${mediaGroupId} from message ${messageId}`);
    
    // Call the sync function
    const { data: syncResult, error: syncError } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: messageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId
      }
    );
    
    if (syncError) {
      throw new Error(`Media group sync failed: ${syncError.message}`);
    }
    
    console.log(`Successfully synced to ${syncResult?.updated_count || 0} messages in group`);
    
    return {
      success: true,
      syncedCount: syncResult?.updated_count || 0,
      source_message_id: messageId
    };
  } catch (error) {
    console.error(`Error syncing media group: ${error.message}`);
    return {
      success: false,
      reason: 'sync_error',
      error: error.message
    };
  }
};

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
      },
      correlation_id: correlationId
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging analysis event:', error);
    return { success: false, error: error.message };
  }
};
