
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { parseCaption } from './captionParser.ts';
import { 
  getMessage, 
  updateMessageWithAnalysis, 
  markQueueItemAsFailed,
  syncMediaGroupContent,
  logAnalysisEvent
} from './dbOperations.ts';
import { ParsedContent } from './types.ts';

// Create Supabase client for any additional operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Clone the request body so we can use it multiple times if needed
  const clonedReq = req.clone();
  let payload;
  let messageId;
  let caption;
  let media_group_id;
  let correlationId;
  let queue_id;
  let isEdit;

  try {
    // Parse the request payload
    payload = await req.json();
    
    // Extract parameters from payload
    ({ messageId, caption, media_group_id, correlationId, queue_id, isEdit } = payload);
    
    // Log request details but sanitize caption length for logs
    const captionForLog = caption ? 
      (caption.length > 50 ? `${caption.substring(0, 50)}...` : caption) : 
      '(none)';
    
    console.log(`Processing caption for message ${messageId}, correlation_id: ${correlationId}, isEdit: ${isEdit}, caption: ${captionForLog}`);

    // Validate required parameters
    if (!messageId || !caption) {
      throw new Error("Required parameters missing: messageId and caption are required");
    }

    // First, get the current message state
    console.log(`Fetching current state for message ${messageId}`);
    const existingMessage = await getMessage(messageId);
    console.log(`Current message state: ${JSON.stringify(existingMessage)}`);

    // Perform manual parsing
    console.log(`Performing manual parsing on caption: ${captionForLog}`);
    let parsedContent: ParsedContent = parseCaption(caption);
    console.log(`Manual parsing result: ${JSON.stringify(parsedContent)}`);

    // Save additional metadata
    parsedContent.caption = caption;
    
    if (media_group_id) {
      parsedContent.sync_metadata = {
        media_group_id: media_group_id
      };
    }
    
    // Add edit flag to metadata if this is from an edit
    if (isEdit) {
      console.log(`Message ${messageId} is being processed as an edit`);
      parsedContent.parsing_metadata.is_edit = true;
      parsedContent.parsing_metadata.edit_timestamp = new Date().toISOString();
    }

    // Log the analysis in the audit trail
    console.log(`Logging analysis event for message ${messageId}`);
    await logAnalysisEvent(
      messageId,
      correlationId || 'manual-analysis',
      { analyzed_content: existingMessage?.analyzed_content },
      { analyzed_content: parsedContent },
      {
        source: 'parse-caption-with-ai',
        caption: captionForLog,
        media_group_id: media_group_id,
        method: 'manual',
        is_edit: isEdit
      }
    );

    // Update the message with the analyzed content
    console.log(`Updating message ${messageId} with analyzed content, isEdit: ${isEdit}`);
    const updateResult = await updateMessageWithAnalysis(messageId, parsedContent, existingMessage, queue_id, isEdit);
    console.log(`Update result: ${JSON.stringify(updateResult)}`);

    // Always attempt to sync content to media group
    let syncResult = null;
    if (media_group_id) {
      console.log(`Starting media group content sync for group ${media_group_id}, message ${messageId}`);
      syncResult = await syncMediaGroupContent(media_group_id, messageId, correlationId || 'manual-sync');
      console.log(`Media group sync result: ${JSON.stringify(syncResult)}`);
    } else {
      console.log(`No media_group_id provided, skipping group sync`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption analyzed successfully for message ${messageId}`,
        data: parsedContent,
        sync_result: syncResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    // Since we already consumed the request body, use the extracted variables
    // instead of trying to parse the body again
    try {
      // We already have messageId and queue_id from above, so use those
      // instead of trying to parse the request body again
      
      if (messageId) {
        // Update the message directly with error
        await supabaseClient
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            last_error_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
      
      if (queue_id) {
        await markQueueItemAsFailed(queue_id, error.message);
      }
    } catch (reqError) {
      console.error('Error processing error handling:', reqError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error processing caption: ${error.message}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
