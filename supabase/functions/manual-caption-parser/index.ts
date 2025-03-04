
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";
import { parseCaption } from "./captionParser.ts";
import { ParsedContent } from "./types.ts";

// Create Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const manualCaptionParser = async (req: Request, correlationId: string) => {
  // Parse request body
  const body = await req.json();
  const { messageId, caption, media_group_id, trigger_source = 'database_trigger', isEdit = false } = body;
  
  if (!messageId) {
    throw new Error("Message ID is required");
  }

  console.log(`Manual caption parser triggered for message ${messageId}, correlation ID: ${correlationId}, isEdit: ${isEdit}`);
  
  try {
    // Get the message details if caption wasn't provided
    let messageCaption = caption;
    let messageGroupId = media_group_id;
    let existingMessage = null;

    if (!messageCaption) {
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('id, caption, media_group_id, processing_state, analyzed_content, old_analyzed_content')
        .eq('id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error(`Message not found: ${messageError?.message || 'Unknown error'}`);
      }
      
      // Skip processing if no caption or already processed (and not an edit)
      if (!message.caption || (message.processing_state === 'completed' && !isEdit)) {
        return new Response(
          JSON.stringify({
            success: true,
            message: `Message ${messageId} skipped: ${!message.caption ? 'No caption' : 'Already processed'}`,
            correlation_id: correlationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      messageCaption = message.caption;
      messageGroupId = message.media_group_id;
      existingMessage = message;
    } else {
      // If caption was provided but we need existing message data for edit handling
      if (isEdit) {
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('analyzed_content, old_analyzed_content')
          .eq('id', messageId)
          .single();
          
        if (!messageError && message) {
          existingMessage = message;
        }
      }
    }

    console.log(`Processing caption for message ${messageId}, caption length: ${messageCaption.length}, isEdit: ${isEdit}`);
    
    // Use our manual caption parser
    const parsedContent = parseCaption(messageCaption);
    
    console.log(`Caption parsed successfully for message ${messageId}:`, parsedContent);
    
    // Prepare update data
    const updateData: any = {
      analyzed_content: parsedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      is_original_caption: true,
      updated_at: new Date().toISOString()
    };
    
    // Handle edit history properly
    if (isEdit && existingMessage?.analyzed_content) {
      // Prepare old_analyzed_content array
      let oldAnalyzedContent = [];
      
      if (existingMessage.old_analyzed_content) {
        oldAnalyzedContent = Array.isArray(existingMessage.old_analyzed_content) ? 
          [...existingMessage.old_analyzed_content] : 
          [existingMessage.old_analyzed_content];
      }
      
      // Add timestamp to the previous content before storing it
      const previousContent = {
        ...existingMessage.analyzed_content,
        edit_timestamp: new Date().toISOString()
      };
      
      oldAnalyzedContent.push(previousContent);
      updateData.old_analyzed_content = oldAnalyzedContent;
      
      // Add edit metadata to the new parsed content
      parsedContent.parsing_metadata = {
        ...parsedContent.parsing_metadata,
        is_edit: true,
        edit_timestamp: new Date().toISOString()
      };
      
      updateData.analyzed_content = parsedContent;
      console.log(`Storing edit history for message ${messageId}, previous edits: ${oldAnalyzedContent.length}`);
    }
    
    // Update the message with the analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Error updating message: ${updateError.message}`);
    }
    
    // If this is part of a media group, sync the content to other messages in the group
    let syncResult = null;
    if (messageGroupId) {
      try {
        const { data, error } = await supabase.rpc(
          'xdelo_sync_media_group_content',
          {
            p_source_message_id: messageId,
            p_media_group_id: messageGroupId,
            p_correlation_id: correlationId,
            p_force_sync: true,
            p_sync_edit_history: isEdit
          }
        );
        
        if (error) {
          console.warn(`Warning: Media group sync via RPC failed: ${error.message}`);
          // Fallback to direct update
          await syncMediaGroupFallback(messageId, messageGroupId, parsedContent, isEdit);
        } else {
          syncResult = data;
        }
      } catch (syncError) {
        console.error(`Media group sync error: ${syncError.message}`);
        // Attempt fallback sync
        await syncMediaGroupFallback(messageId, messageGroupId, parsedContent, isEdit);
      }
    }
    
    // Log successful parsing
    await supabase.from('unified_audit_logs').insert({
      event_type: 'manual_caption_parsed',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        is_edit: isEdit,
        caption_length: messageCaption.length,
        media_group_id: messageGroupId,
        has_sync_result: !!syncResult
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption processed for message ${messageId}`,
        data: parsedContent,
        sync_result: syncResult,
        correlation_id: correlationId,
        is_edit: isEdit
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error in manual caption parser: ${error.message}`);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'manual_caption_parser_error',
      entity_id: messageId,
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        is_edit: isEdit,
        error_stack: error.stack
      },
      event_timestamp: new Date().toISOString()
    });
    
    // Update message with error state
    await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: `Manual parsing error: ${error.message}`,
        last_error_at: new Date().toISOString(),
        retry_count: supabase.rpc('increment_retry_count', { message_id: messageId })
      })
      .eq('id', messageId);
    
    throw error;
  }
};

// Fallback function to sync media group content directly
async function syncMediaGroupFallback(
  sourceMessageId: string, 
  mediaGroupId: string,
  analyzedContent: ParsedContent,
  isEdit: boolean = false
): Promise<void> {
  try {
    // Get the current source message to ensure it has analyzed_content
    const { data: sourceMessage } = await supabase
      .from('messages')
      .select('analyzed_content, old_analyzed_content')
      .eq('id', sourceMessageId)
      .single();
    
    if (!sourceMessage?.analyzed_content) {
      console.error("Source message has no analyzed_content for fallback sync");
      return;
    }
    
    // Basic update data for all messages in the group
    const updateData: any = {
      analyzed_content: analyzedContent,
      message_caption_id: sourceMessageId,
      is_original_caption: false,
      group_caption_synced: true,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // If this is an edit and we need to sync edit history
    if (isEdit && sourceMessage.old_analyzed_content) {
      updateData.old_analyzed_content = sourceMessage.old_analyzed_content;
    }
    
    // Update all other messages in the group
    await supabase
      .from('messages')
      .update(updateData)
      .eq('media_group_id', mediaGroupId)
      .neq('id', sourceMessageId);
    
    console.log(`Fallback sync completed for media group ${mediaGroupId}, isEdit: ${isEdit}`);
  } catch (error) {
    console.error(`Fallback sync error: ${error.message}`);
  }
}

// Wrap the handler with error handling
serve(withErrorHandling('manual-caption-parser', manualCaptionParser));
