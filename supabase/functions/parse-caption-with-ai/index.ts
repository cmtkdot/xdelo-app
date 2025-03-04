
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
import {
  withErrorHandling,
  logErrorToDatabase,
  updateMessageWithError
} from '../_shared/errorHandler.ts';

// Create Supabase client for any additional operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler with error handling wrapper
const handleCaptionAnalysis = async (req: Request, correlationId: string) => {
  // Safely parse the request body
  const body = await req.json();
  
  // Extract and validate required parameters
  const { 
    messageId, 
    caption, 
    media_group_id, 
    queue_id, 
    isEdit = false,
    retryCount = 0
  } = body;
  
  // Use the passed correlation ID or the one from the request
  const requestCorrelationId = body.correlationId || correlationId;
  
  // Log request details but sanitize caption length for logs
  const captionForLog = caption ? 
    (caption.length > 50 ? `${caption.substring(0, 50)}...` : caption) : 
    '(none)';
  
  console.log(`Processing caption for message ${messageId}, correlation_id: ${requestCorrelationId}, isEdit: ${isEdit}, retry: ${retryCount}, caption: ${captionForLog}`);

  // Validate required parameters
  if (!messageId || !caption) {
    throw new Error("Required parameters missing: messageId and caption are required");
  }

  try {
    // First, get the current message state
    console.log(`Fetching current state for message ${messageId}`);
    const existingMessage = await getMessage(messageId);
    
    // Skip if message already has analyzed content
    if (existingMessage?.analyzed_content && !isEdit) {
      console.log(`Message ${messageId} already has analyzed content, skipping`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `Message already has analyzed content`,
          data: existingMessage.analyzed_content,
          correlation_id: requestCorrelationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Current message state: ${JSON.stringify({
      id: existingMessage?.id,
      processing_state: existingMessage?.processing_state,
      has_analyzed_content: !!existingMessage?.analyzed_content,
      media_group_id: existingMessage?.media_group_id
    })}`);

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
    
    if (retryCount > 0) {
      parsedContent.parsing_metadata.retry_count = retryCount;
      parsedContent.parsing_metadata.retry_timestamp = new Date().toISOString();
    }

    // Log the analysis in the audit trail
    console.log(`Logging analysis event for message ${messageId}`);
    await logAnalysisEvent(
      messageId,
      requestCorrelationId,
      { analyzed_content: existingMessage?.analyzed_content },
      { analyzed_content: parsedContent },
      {
        source: 'parse-caption-with-ai',
        caption: captionForLog,
        media_group_id: media_group_id,
        method: 'manual',
        is_edit: isEdit,
        retry_count: retryCount
      }
    );

    // Update the message with the analyzed content
    console.log(`Updating message ${messageId} with analyzed content, isEdit: ${isEdit}`);
    const updateResult = await updateMessageWithAnalysis(
      messageId, 
      parsedContent, 
      existingMessage, 
      queue_id, 
      isEdit
    );
    console.log(`Update result: ${JSON.stringify(updateResult)}`);

    // Always attempt to sync content to media group if this message has a caption
    let syncResult = null;
    if (media_group_id) {
      try {
        console.log(`Starting media group content sync for group ${media_group_id}, message ${messageId}`);
        
        // First try the edge function directly
        const syncResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/xdelo_sync_media_group`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              mediaGroupId: media_group_id,
              sourceMessageId: messageId,
              correlationId: requestCorrelationId
            })
          }
        );
        
        if (syncResponse.ok) {
          syncResult = await syncResponse.json();
          console.log(`Media group sync result from edge function: ${JSON.stringify(syncResult)}`);
        } else {
          // Fallback to direct function call
          console.warn(`Edge function sync failed with ${syncResponse.status}, trying direct sync`);
          syncResult = await syncMediaGroupContent(media_group_id, messageId, requestCorrelationId);
          console.log(`Media group sync result from direct function: ${JSON.stringify(syncResult)}`);
        }
      } catch (syncError) {
        console.error(`Media group sync error (non-fatal): ${syncError.message}`);
        // Log the error but don't fail the entire operation
        await logErrorToDatabase(supabaseClient, {
          messageId,
          errorMessage: `Media group sync error: ${syncError.message}`,
          correlationId: requestCorrelationId,
          functionName: 'parse-caption-with-ai'
        });
      }
    } else {
      console.log(`No media_group_id provided, skipping group sync`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption analyzed successfully for message ${messageId}`,
        data: parsedContent,
        sync_result: syncResult,
        correlation_id: requestCorrelationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error analyzing caption: ${error.message}`);
    
    // Log detailed error and update message state
    await logErrorToDatabase(supabaseClient, {
      messageId,
      errorMessage: error.message,
      correlationId: requestCorrelationId,
      functionName: 'parse-caption-with-ai'
    });
    
    // Update message with error state
    await updateMessageWithError(supabaseClient, messageId, error.message, requestCorrelationId);
    
    // If queue_id exists, mark the queue item as failed
    if (queue_id) {
      await markQueueItemAsFailed(queue_id, error.message);
    }
    
    throw error;
  }
};

// Wrap the handler with error handling
serve(withErrorHandling('parse-caption-with-ai', handleCaptionAnalysis));
