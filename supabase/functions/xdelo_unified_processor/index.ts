
/**
 * Unified Processor Edge Function
 * Handles all message processing operations in one place
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { Logger } from "../telegram-webhook/utils/logger.ts";
import { xdelo_processMessageCaption, xdelo_syncMediaGroupContent } from "../_shared/captionProcessing.ts";
import { withErrorHandling, SecurityLevel } from "../_shared/jwt-verification.ts";

interface ProcessorRequest {
  operation: 'process_caption' | 'sync_media_group' | 'reprocess' | 'delayed_sync';
  messageId?: string;
  mediaGroupId?: string;
  force?: boolean;
  correlationId?: string;
}

// Create Supabase client using service role key
const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};

/**
 * Main handler for the unified processor
 */
const handleUnifiedProcessorRequest = async (req: Request, correlationId: string) => {
  const startTime = Date.now();
  
  // Create logger for this request
  const logger = new Logger(correlationId, "unified-processor");
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Parse request body
    const requestData: ProcessorRequest = await req.json();
    logger.info(`Processing request: ${requestData.operation}`, requestData);
    
    // Use provided correlation ID or the generated one
    const reqCorrelationId = requestData.correlationId || correlationId;
    
    // Process based on operation type
    switch (requestData.operation) {
      case 'process_caption':
        // Validate required parameters
        if (!requestData.messageId) {
          return createErrorResponse("Missing required parameter: messageId", 400, reqCorrelationId);
        }
        
        // Get the message first to check if it has a caption
        logger.info(`Getting message ${requestData.messageId} to check for caption`);
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .select('*')
          .eq('id', requestData.messageId)
          .single();
        
        if (messageError || !message) {
          logger.error(`Error retrieving message: ${messageError?.message || "Message not found"}`);
          return createErrorResponse(
            `Error retrieving message: ${messageError?.message || "Message not found"}`,
            404,
            reqCorrelationId
          );
        }
        
        // If message has no caption and is not part of a media group, return error
        if (!message.caption && !message.media_group_id) {
          logger.warn(`Message ${requestData.messageId} has no caption and is not part of a media group`);
          return createErrorResponse(
            "Message has no caption and is not part of a media group",
            400,
            reqCorrelationId
          );
        }
        
        // Process the caption
        logger.info(`Processing caption for message ${requestData.messageId}`, {
          has_caption: !!message.caption,
          caption_length: message.caption?.length,
          media_group_id: message.media_group_id
        });
        
        const captionResult = await xdelo_processMessageCaption(
          supabase,
          requestData.messageId,
          reqCorrelationId,
          !!requestData.force,
          logger
        );
        
        // If message is part of a media group, also sync the media group content
        if (message.media_group_id && captionResult.success) {
          logger.info(`Message is part of media group ${message.media_group_id}, syncing content`);
          
          try {
            const syncResult = await xdelo_syncMediaGroupContent(
              supabase,
              requestData.messageId,
              message.media_group_id,
              reqCorrelationId,
              !!requestData.force,
              false, // Don't sync edit history by default
              logger
            );
            
            if (syncResult.success) {
              logger.info(`Successfully synced media group ${message.media_group_id}`);
              
              // Include sync results in the response
              return createSuccessResponse({
                caption_processing: captionResult.data,
                media_group_sync: syncResult.data
              }, reqCorrelationId);
            } else {
              logger.warn(`Failed to sync media group: ${syncResult.error}`);
            }
          } catch (syncError) {
            logger.error(`Error syncing media group: ${syncError.message}`);
            // Continue and return the caption processing result
          }
        }
        
        return createSuccessResponse(captionResult.data, reqCorrelationId);
        
      case 'sync_media_group':
        // Validate required parameters
        if (!requestData.messageId) {
          return createErrorResponse("Missing required parameter: messageId", 400, reqCorrelationId);
        }
        
        if (!requestData.mediaGroupId) {
          return createErrorResponse("Missing required parameter: mediaGroupId", 400, reqCorrelationId);
        }
        
        // Sync the media group
        const syncResult = await xdelo_syncMediaGroupContent(
          supabase,
          requestData.messageId,
          requestData.mediaGroupId,
          reqCorrelationId,
          !!requestData.force,
          false, // Don't sync edit history by default
          logger
        );
        
        return createSuccessResponse(syncResult.data, reqCorrelationId);
        
      case 'reprocess':
        // Validate required parameters
        if (!requestData.messageId) {
          return createErrorResponse("Missing required parameter: messageId", 400, reqCorrelationId);
        }
        
        // Reprocess the message with force = true
        const reprocessResult = await xdelo_processMessageCaption(
          supabase,
          requestData.messageId,
          reqCorrelationId,
          true, // Always force for reprocessing
          logger
        );
        
        return createSuccessResponse(reprocessResult.data, reqCorrelationId);
        
      case 'delayed_sync':
        // Validate required parameters
        if (!requestData.mediaGroupId) {
          return createErrorResponse("Missing required parameter: mediaGroupId", 400, reqCorrelationId);
        }
        
        // Find the original caption message in this group
        const { data: captionMessage, error: findError } = await supabase.rpc(
          'xdelo_find_caption_message',
          { p_media_group_id: requestData.mediaGroupId }
        );
        
        if (findError || !captionMessage) {
          return createErrorResponse(
            `Error finding caption message: ${findError?.message || "No caption message found"}`,
            404,
            reqCorrelationId
          );
        }
        
        // Sync using the found caption message
        const delayedSyncResult = await xdelo_syncMediaGroupContent(
          supabase,
          captionMessage,
          requestData.mediaGroupId,
          reqCorrelationId,
          true, // Force sync for delayed operations
          false, // Don't sync edit history
          logger
        );
        
        return createSuccessResponse({
          ...delayedSyncResult.data,
          caption_message_id: captionMessage
        }, reqCorrelationId);
        
      default:
        return createErrorResponse(`Unknown operation: ${(requestData as any).operation}`, 400, reqCorrelationId);
    }
  } catch (error) {
    logger.error(`Unhandled error in unified processor: ${error.message}`, { error });
    
    return createErrorResponse(
      error.message || "Unknown error",
      500,
      correlationId
    );
  } finally {
    logger.info(`Request completed in ${Date.now() - startTime}ms`);
  }
};

/**
 * Create a standardized success response
 */
function createSuccessResponse(data: any, correlationId: string): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      correlationId
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  );
}

/**
 * Create a standardized error response
 */
function createErrorResponse(message: string, status: number, correlationId: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      correlationId
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status
    }
  );
}

// Use the withErrorHandling wrapper for secure endpoint handling
serve(
  withErrorHandling(
    "xdelo_unified_processor",
    handleUnifiedProcessorRequest,
    {
      securityLevel: SecurityLevel.SERVICE_ROLE, // Restrict to internal service calls only
      bypassForServiceRole: true // Allow service role tokens to bypass auth
    }
  )
);
