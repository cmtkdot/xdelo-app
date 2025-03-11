
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { xdelo_parseCaption, ParsedContent } from '../_shared/captionParser.ts';
import { withErrorHandling } from "../_shared/errorHandler.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handleCaptionParsing = async (req: Request, correlationId: string) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, is_edit = false } = await req.json();
    
    console.log(`Manual caption parsing for message ${messageId}, correlation ID: ${correlationId}`);
    
    if (!messageId || !caption) {
      throw new Error('Missing required parameters: messageId and caption are required');
    }
    
    // Parse the caption
    console.log(`Parsing caption: ${caption.substring(0, 50)}${caption.length > 50 ? '...' : ''}`);
    const parsedContent = xdelo_parseCaption(caption);
    
    // Add the original caption and media group metadata
    parsedContent.caption = caption;
    
    if (media_group_id) {
      parsedContent.sync_metadata = {
        media_group_id: media_group_id
      };
    }
    
    // Add edit flag if this is an edit
    if (is_edit) {
      parsedContent.parsing_metadata.is_edit = true;
      parsedContent.parsing_metadata.edit_timestamp = new Date().toISOString();
    }
    
    console.log(`Parsed content: ${JSON.stringify(parsedContent)}`);
    
    // Update the message with the analyzed content
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('id, analyzed_content, processing_state, media_group_id')
      .eq('id', messageId)
      .single();
    
    if (messageError) {
      throw new Error(`Message lookup error: ${messageError.message}`);
    }
    
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }
    
    // If not an edit and message already has analyzed content, return it without changes
    if (!is_edit && message.analyzed_content) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Message already has analyzed content',
          parsed_content: message.analyzed_content,
          existing: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create old_analyzed_content array if editing
    let oldAnalyzedContent = [];
    if (is_edit && message.analyzed_content) {
      // Get current old_analyzed_content array if it exists
      const { data: oldVersions } = await supabaseClient
        .from('messages')
        .select('old_analyzed_content')
        .eq('id', messageId)
        .single();
      
      // Build new array with current content added
      oldAnalyzedContent = oldVersions?.old_analyzed_content || [];
      oldAnalyzedContent.push(message.analyzed_content);
    }
    
    // Update the message
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: parsedContent.parsing_metadata.partial_success ? 'partial_success' : 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: message.media_group_id ? true : undefined,
        group_caption_synced: true,
        old_analyzed_content: is_edit ? oldAnalyzedContent : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Error updating message: ${updateError.message}`);
    }
    
    // Log the analysis event
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'manual_caption_parsed',
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        parsed_content: parsedContent,
        caption_length: caption.length,
        media_group_id: message.media_group_id,
        is_edit: is_edit,
        partial_success: parsedContent.parsing_metadata.partial_success
      },
      event_timestamp: new Date().toISOString()
    });
    
    // If part of a media group, sync content to other messages
    let syncResult = null;
    if (message.media_group_id) {
      try {
        // First try the dedicated edge function
        const syncResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              mediaGroupId: message.media_group_id,
              sourceMessageId: messageId,
              correlationId: correlationId,
              forceSync: true,
              syncEditHistory: is_edit
            })
          }
        );
        
        if (syncResponse.ok) {
          syncResult = await syncResponse.json();
          console.log(`Sync completed through edge function: ${syncResult?.synced_count ?? 0} messages`);
        } else {
          console.warn(`Edge function sync failed with ${syncResponse.status}, falling back to direct DB query`);
          
          // Fallback: Direct DB query to sync content
          const { data: syncQueryResult, error: syncError } = await supabaseClient.rpc(
            'xdelo_sync_media_group_content',
            {
              p_source_message_id: messageId,
              p_media_group_id: message.media_group_id,
              p_correlation_id: correlationId,
              p_force_sync: true,
              p_sync_edit_history: is_edit
            }
          );
          
          if (syncError) {
            throw syncError;
          }
          
          syncResult = syncQueryResult;
          console.log(`Sync completed through direct query: ${syncResult?.synced_count ?? 0} messages`);
        }
      } catch (syncError) {
        console.error(`Media group sync error (non-fatal): ${syncError.message}`);
        
        // Log the error but continue
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: 'manual_caption_parser_error',
          entity_id: messageId,
          correlation_id: correlationId,
          error_message: `Media group sync error: ${syncError.message}`,
          metadata: {
            media_group_id: message.media_group_id,
            error_detail: syncError.stack
          },
          event_timestamp: new Date().toISOString()
        });
        
        syncResult = { 
          error: syncError.message, 
          success: false 
        };
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption parsed successfully for message ${messageId}`,
        parsed_content: parsedContent,
        sync_result: syncResult,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in manual-caption-parser:', error);
    
    // Log the error
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'manual_caption_parser_error',
        error_message: error.message,
        correlation_id: correlationId,
        metadata: {
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log parser error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

// Serve the wrapped handler
serve(withErrorHandling('manual-caption-parser', handleCaptionParsing));
