import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { ParsedContent } from './types.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function getMessage(messageId: string) {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('id, caption, analyzed_content, processing_state, media_group_id, is_original_caption, old_analyzed_content, edit_history')
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
  queueId?: string, // Kept for backward compatibility but no longer used
  isForceUpdate: boolean = false
) {
  try {
    // Determine if we need to save old content for edit history
    let oldAnalyzedContent = [];
    
    if (isForceUpdate && existingMessage?.analyzed_content) {
      // Get existing old_analyzed_content array
      oldAnalyzedContent = existingMessage?.old_analyzed_content || [];
      
      // Add current content to history with archive reason
      const archiveReason = parsedContent.parsing_metadata.is_edit ? 
        'edit' : 
        'forced_reprocess';
        
      oldAnalyzedContent.push({
        ...existingMessage.analyzed_content,
        archived_timestamp: new Date().toISOString(),
        archived_reason: archiveReason
      });
    }
    
    // Update edit history
    let editHistory = existingMessage?.edit_history || [];
    if (isForceUpdate) {
      // Determine edit type
      const editType = parsedContent.parsing_metadata.is_edit ? 
        'edit' : 
        'forced_reprocess';
        
      // Add to edit history
      editHistory.push({
        timestamp: new Date().toISOString(),
        type: editType,
        previous_analyzed_content: existingMessage?.analyzed_content || null
      });
    }
    
    // Always use 'completed' as the processing state
    const processingState = 'completed';
    
    // Update message with analyzed content using direct update
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: processingState,
        processing_completed_at: new Date().toISOString(),
        is_original_caption: existingMessage?.media_group_id ? true : undefined,
        group_caption_synced: existingMessage?.media_group_id ? false : undefined, // Will be synced later
        old_analyzed_content: oldAnalyzedContent.length > 0 ? oldAnalyzedContent : undefined,
        edit_history: editHistory.length > 0 ? editHistory : undefined,
        edit_count: isForceUpdate ? (existingMessage?.edit_count || 0) + 1 : existingMessage?.edit_count,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      throw new Error(`Error updating message with analysis: ${updateError.message}`);
    }
    
    // Log the analysis completion
    await logAnalysisEvent(
      messageId,
      existingMessage?.correlation_id || 'no-correlation-id',
      {
        processing_state: existingMessage?.processing_state || 'unknown',
        analyzed_content: existingMessage?.analyzed_content
      },
      {
        processing_state: processingState,
        analyzed_content: parsedContent
      },
      {
        is_force_update: isForceUpdate,
        is_edit: parsedContent.parsing_metadata.is_edit || false,
        timestamp: new Date().toISOString()
      }
    );
    
    // If part of a media group, sync the content to other messages using our simplified edge function
    if (existingMessage?.media_group_id) {
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
              mediaGroupId: existingMessage.media_group_id,
              sourceMessageId: messageId,
              correlationId: existingMessage?.correlation_id || 'no-correlation-id',
              forceSync: true,
              syncEditHistory: parsedContent.parsing_metadata.is_edit || false
            })
          }
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Edge function sync failed: ${errorText || response.statusText}`);
        }
        
        return await response.json();
      } catch (syncError) {
        console.error(`Error syncing media group content: ${syncError.message}`);
        throw syncError;
      }
    }
    
    return { success: true, processed: true };
  } catch (error) {
    console.error(`Error in updateMessageWithAnalysis: ${error.message}`);
    throw error;
  }
}

export async function markQueueItemAsFailed(queueId: string, errorMessage: string) {
  // This is now a no-op since the queue table is gone
  console.log(`Queue is deprecated. Error for operation: ${errorMessage}`);
  return;
}

export async function syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  isEdit: boolean = false
) {
  try {
    // Use our simplified edge function for media group sync
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
          sourceMessageId,
          correlationId,
          forceSync: true,
          syncEditHistory: isEdit
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function sync failed: ${errorText || response.statusText}`);
    }
    
    return await response.json();
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
