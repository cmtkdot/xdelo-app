
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { 
  withErrorHandling, 
  logErrorToDatabase, 
  updateMessageWithError 
} from "../_shared/errorHandler.ts";
import { 
  processCaption, 
  updateMessageWithParsedData,
  getMessageFromQueue,
  markQueueItemAsProcessed,
  markQueueItemAsFailed
} from "./dbOperations.ts";
import { ParsedContent } from "./types.ts";

/**
 * Main handler for the parse-caption-with-ai function
 * This processes captions to extract product information
 */
async function handleRequest(req: Request, correlationId: string): Promise<Response> {
  // Parse request body
  let message_id: string | null = null;
  let caption: string | null = null;
  let source: string = 'api';
  let queue_id: string | null = null;
  let requestCorrelationId = correlationId;
  
  try {
    if (req.method === 'POST') {
      const requestData = await req.json();
      message_id = requestData.message_id;
      caption = requestData.caption;
      source = requestData.source || 'api';
      queue_id = requestData.queue_id || null;
      requestCorrelationId = requestData.correlation_id || correlationId;
    } else if (req.method === 'GET') {
      // Pull from queue if no specific message is provided
      const queueItem = await getMessageFromQueue();
      if (queueItem) {
        message_id = queueItem.message_id;
        caption = queueItem.caption;
        queue_id = queueItem.id;
        source = 'queue';
      }
    }
    
    // Validate required params
    if (!message_id) {
      throw new Error("Missing required parameter: message_id");
    }
    
    // If caption is not provided, fetch it from the database
    if (!caption) {
      const { data, error } = await supabaseClient
        .from("messages")
        .select("caption")
        .eq("id", message_id)
        .single();
        
      if (error) {
        throw new Error(`Failed to fetch message caption: ${error.message}`);
      }
      
      caption = data?.caption;
      if (!caption) {
        throw new Error("Message has no caption to process");
      }
    }
    
    console.log(`Processing caption for message ${message_id}`);
    
    // Process the caption using AI (OpenAI)
    let result: ParsedContent;
    try {
      result = await processCaption(caption);
    } catch (e) {
      console.error("AI error:", e);
      throw new Error(`AI processing error: ${e.message}`);
    }
    
    // Update the message with the parsed data
    try {
      await updateMessageWithParsedData(message_id, result);
    } catch (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Database update error: ${dbError.message}`);
    }
    
    // If this was from the queue, mark it as processed
    if (queue_id) {
      await markQueueItemAsProcessed(queue_id);
    }
    
    // Check if the message is part of a media group - if so, sync with other messages
    try {
      const { data: messageData } = await supabaseClient
        .from("messages")
        .select("media_group_id")
        .eq("id", message_id)
        .single();
          
      if (messageData?.media_group_id) {
        // Call RPC to sync the media group content
        const { data: syncResult, error: syncError } = await supabaseClient.rpc(
          'xdelo_sync_media_group_content',
          {
            p_source_message_id: message_id,
            p_media_group_id: messageData.media_group_id,
            p_correlation_id: requestCorrelationId,
            p_force_sync: true
          }
        );
        
        if (syncError) {
          throw new Error(`Media group sync error: ${syncError.message}`);
        }
      }
    } catch (syncError) {
      console.error(`Media group sync error (non-fatal): ${syncError.message}`);
      await logErrorToDatabase({
        messageId,
        errorMessage: `Media group sync error: ${syncError.message}`,
        correlationId: requestCorrelationId,
        functionName: 'parse-caption-with-ai',
        metadata: { source }
      });
      // Don't fail the whole function for a sync error
    }
    
    // Return successful response
    return new Response(
      JSON.stringify({
        success: true,
        message_id: message_id,
        result: result,
        source: source
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      }
    );
    
  } catch (error) {
    console.error(`Error analyzing caption: ${error.message}`);
    
    await logErrorToDatabase({
      messageId,
      errorMessage: error.message,
      correlationId: requestCorrelationId,
      functionName: 'parse-caption-with-ai'
    });
    
    await updateMessageWithError(messageId, error.message, requestCorrelationId);
    
    if (queue_id) {
      await markQueueItemAsFailed(queue_id, error.message);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message_id: message_id,
        correlation_id: requestCorrelationId
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 500
      }
    );
  }
}

// Wrap handler with error handling
const handler = withErrorHandling(
  "parse-caption-with-ai",
  handleRequest,
  { logToDatabase: true }
);

// Start the server
serve(handler);
