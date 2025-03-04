
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { parseCaption } from './captionParser.ts';
import { 
  getMessage, 
  updateMessageWithAnalysis, 
  syncMediaGroupContent,
  logAnalysisEvent
} from './dbOperations.ts';
import { ParsedContent, RequestPayload } from './types.ts';

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

  try {
    const payload = await req.json() as RequestPayload;
    const { messageId, caption, media_group_id, correlationId, isEdit } = payload;
    
    // Log request details but sanitize caption length for logs
    const captionForLog = caption ? 
      (caption.length > 50 ? `${caption.substring(0, 50)}...` : caption) : 
      '(none)';
    
    console.log(`Processing caption for message ${messageId}, correlation_id: ${correlationId}, isEdit: ${isEdit}, caption: ${captionForLog}`);

    if (!messageId) {
      throw new Error("Required parameter missing: messageId is required");
    }

    // First, get the current message state
    console.log(`Fetching current state for message ${messageId}`);
    const existingMessage = await getMessage(messageId);
    console.log(`Current message state: ${JSON.stringify(existingMessage)}`);

    // If no caption but has media_group_id, check if we can sync from group
    if ((!caption || caption.trim() === '') && media_group_id) {
      console.log(`No caption provided for message ${messageId}, checking media group ${media_group_id}`);
      
      // Check if message is already processed (race condition)
      if (existingMessage?.analyzed_content) {
        console.log(`Message ${messageId} already has analyzed content, no further processing needed`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Message ${messageId} already analyzed`,
            data: existingMessage.analyzed_content
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Try to sync from media group
      console.log(`Attempting to sync content from media group ${media_group_id}`);
      const syncResult = await syncMediaGroupContent(media_group_id, messageId, correlationId || 'direct-sync');
      
      if (syncResult.success) {
        console.log(`Successfully synced from media group: ${JSON.stringify(syncResult)}`);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Content synced from media group for message ${messageId}`,
            sync_result: syncResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.log(`Failed to sync from media group: ${JSON.stringify(syncResult)}`);
        throw new Error(`No caption available and failed to sync from media group: ${syncResult.error || syncResult.reason}`);
      }
    }

    // If we got here and still don't have a caption, we can't proceed
    if (!caption || caption.trim() === '') {
      throw new Error("Required parameter missing: caption is required");
    }

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
    const updateResult = await updateMessageWithAnalysis(messageId, parsedContent, existingMessage, undefined, isEdit);
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
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error processing caption: ${error.message}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
