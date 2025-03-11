
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ParsedContent } from '../_shared/captionParser.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function getMessage(messageId: string) {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('id, caption, analyzed_content, processing_state, media_group_id, is_original_caption')
    .eq('id', messageId)
    .single();
    
  if (error) {
    throw new Error(`Error fetching message: ${error.message}`);
  }
  
  return data;
}

export async function updateMessageWithAnalysis(
  messageId: string,
  parsedContent: ParsedContent,
  existingMessage: any,
  queueId?: string,
  isEdit: boolean = false
) {
  // Determine if we need to save old content for edit history
  let oldAnalyzedContent = [];
  
  if (isEdit && existingMessage?.analyzed_content) {
    const { data: oldVersions } = await supabaseClient
      .from('messages')
      .select('old_analyzed_content')
      .eq('id', messageId)
      .single();
      
    oldAnalyzedContent = oldVersions?.old_analyzed_content || [];
    oldAnalyzedContent.push(existingMessage.analyzed_content);
  }
  
  // Determine processing state based on partial success flag
  const processingState = parsedContent.parsing_metadata.partial_success 
    ? 'partial_success' 
    : 'completed';
  
  // Update message with analyzed content
  const { error: updateError } = await supabaseClient
    .from('messages')
    .update({
      analyzed_content: parsedContent,
      processing_state: processingState,
      processing_completed_at: new Date().toISOString(),
      is_original_caption: existingMessage?.media_group_id ? true : undefined,
      group_caption_synced: true,
      old_analyzed_content: isEdit ? oldAnalyzedContent : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', messageId);
    
  if (updateError) {
    throw new Error(`Error updating message with analysis: ${updateError.message}`);
  }
  
  // If queue ID provided, mark queue item as completed
  if (queueId) {
    await markQueueItemAsCompleted(queueId, parsedContent);
  }
  
  return { success: true, processed: true };
}

async function markQueueItemAsCompleted(queueId: string, parsedContent: ParsedContent) {
  try {
    const { error } = await supabaseClient
      .from('message_processing_queue')
      .update({
        status: 'completed',
        processing_completed_at: new Date().toISOString(),
        metadata: supabaseClient.rpc('jsonb_deep_merge', { 
          a: supabaseClient.rpc('get_column_value', { 
            table_name: 'message_processing_queue', 
            column_name: 'metadata', 
            row_id: queueId 
          }),
          b: { analyzed_content: parsedContent } 
        })
      })
      .eq('id', queueId);
      
    if (error) {
      console.error(`Error marking queue item as completed: ${error.message}`);
    }
  } catch (error) {
    console.error(`Exception marking queue item as completed: ${error.message}`);
  }
}

export async function markQueueItemAsFailed(queueId: string, errorMessage: string) {
  try {
    const { error } = await supabaseClient
      .from('message_processing_queue')
      .update({
        status: 'error',
        error_message: errorMessage,
        last_error_at: new Date().toISOString()
      })
      .eq('id', queueId);
      
    if (error) {
      console.error(`Error marking queue item as failed: ${error.message}`);
    }
  } catch (error) {
    console.error(`Exception marking queue item as failed: ${error.message}`);
  }
}

export async function syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  isEdit: boolean = false
) {
  try {
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: correlationId,
        p_force_sync: true,
        p_sync_edit_history: isEdit
      }
    );
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error(`Error syncing media group content: ${error.message}`);
    throw error;
  }
}

export async function logAnalysisEvent(
  messageId: string,
  correlationId: string,
  oldState: any,
  newState: any,
  metadata: Record<string, any>
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'message_analysis_completed',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        ...metadata,
        old_state: oldState,
        new_state: newState,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging analysis event: ${error.message}`);
  }
}
