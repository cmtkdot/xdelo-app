
// Supabase Edge Function for unified message processing
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../telegram-webhook/utils/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import { createLoggerWithErrorHandling } from "../telegram-webhook/utils/logger.ts";
import { xdelo_logProcessingEvent } from "../_shared/databaseOperations.ts";

interface ProcessorRequest {
  messageId: string;
  operation: 'process_caption' | 'sync_media_group' | 'reprocess' | 'delayed_sync';
  force?: boolean;
  mediaGroupId?: string;
  sourceMessageId?: string;
  correlationId?: string;
}

/**
 * Unified processor for caption parsing, media group synchronization,
 * and other message processing operations
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Create a Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Parse the request body
    const payload: ProcessorRequest = await req.json();
    
    // Generate a correlation ID if not provided
    const correlationId = payload.correlationId || crypto.randomUUID().toString();
    
    // Create a logger for this request
    const { logger, handleError } = createLoggerWithErrorHandling(
      correlationId, 
      "unified-processor"
    );
    
    // Log the request
    logger.info("Processing request", { 
      operation: payload.operation,
      message_id: payload.messageId,
      media_group_id: payload.mediaGroupId,
      correlation_id: correlationId
    });
    
    // Validate required fields
    if (!payload.messageId) {
      logger.error("Missing required field: messageId");
      return new Response(
        JSON.stringify({ error: "Missing required field: messageId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Handle each operation type
    switch (payload.operation) {
      case 'process_caption':
        return await processCaption(
          supabase, 
          payload.messageId, 
          correlationId, 
          payload.force || false,
          logger
        );
        
      case 'sync_media_group':
        if (!payload.mediaGroupId) {
          logger.error("Missing required field for sync_media_group: mediaGroupId");
          return new Response(
            JSON.stringify({ error: "Missing required field: mediaGroupId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return await syncMediaGroup(
          supabase,
          payload.messageId,
          payload.mediaGroupId,
          correlationId,
          payload.force || false,
          true, // Sync edit history
          logger
        );
        
      case 'delayed_sync':
        if (!payload.mediaGroupId) {
          logger.error("Missing required field for delayed_sync: mediaGroupId");
          return new Response(
            JSON.stringify({ error: "Missing required field: mediaGroupId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return await delayedMediaGroupSync(
          supabase,
          payload.mediaGroupId,
          correlationId,
          logger
        );
        
      case 'reprocess':
        return await reprocessMessage(
          supabase,
          payload.messageId,
          correlationId,
          payload.force || false,
          logger
        );
        
      default:
        logger.error("Unknown operation", { operation: payload.operation });
        return new Response(
          JSON.stringify({ error: `Unknown operation: ${payload.operation}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({ 
        error: `Error processing request: ${error instanceof Error ? error.message : String(error)}` 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Process a message's caption
 */
async function processCaption(
  supabase: any, 
  messageId: string, 
  correlationId: string, 
  force: boolean,
  logger: any
) {
  try {
    logger.info("Processing caption", { 
      message_id: messageId, 
      force 
    });
    
    // Call the RPC function to process the caption
    const { data, error } = await supabase.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: messageId,
        p_correlation_id: correlationId,
        p_force: force
      }
    );
    
    if (error) {
      logger.error("Error processing caption", {
        message_id: messageId,
        error: error.message
      });
      
      // Log the error to the database
      await xdelo_logProcessingEvent(
        'caption_processing_error',
        messageId,
        correlationId,
        { error_source: 'unified_processor' },
        error.message
      );
      
      return new Response(
        JSON.stringify({ 
          error: `Error processing caption: ${error.message}`,
          message_id: messageId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.info("Caption processing complete", {
      message_id: messageId,
      result: data
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Caption processed successfully",
        data,
        message_id: messageId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Exception in processCaption", {
      message_id: messageId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return new Response(
      JSON.stringify({ 
        error: `Exception processing caption: ${error instanceof Error ? error.message : String(error)}`,
        message_id: messageId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Synchronize a media group
 */
async function syncMediaGroup(
  supabase: any,
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId: string,
  forceSync: boolean,
  syncEditHistory: boolean,
  logger: any
) {
  try {
    logger.info("Syncing media group", { 
      source_message_id: sourceMessageId, 
      media_group_id: mediaGroupId,
      force_sync: forceSync,
      sync_edit_history: syncEditHistory
    });
    
    // Call the RPC function to sync the media group
    const { data, error } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      }
    );
    
    if (error) {
      logger.error("Error syncing media group", {
        source_message_id: sourceMessageId,
        media_group_id: mediaGroupId,
        error: error.message
      });
      
      // Log the error to the database
      await xdelo_logProcessingEvent(
        'media_group_sync_error',
        sourceMessageId,
        correlationId,
        { 
          media_group_id: mediaGroupId,
          error_source: 'unified_processor'
        },
        error.message
      );
      
      return new Response(
        JSON.stringify({ 
          error: `Error syncing media group: ${error.message}`,
          source_message_id: sourceMessageId,
          media_group_id: mediaGroupId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    logger.info("Media group sync complete", {
      source_message_id: sourceMessageId,
      media_group_id: mediaGroupId,
      result: data
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Media group synced successfully",
        data,
        source_message_id: sourceMessageId,
        media_group_id: mediaGroupId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Exception in syncMediaGroup", {
      source_message_id: sourceMessageId,
      media_group_id: mediaGroupId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return new Response(
      JSON.stringify({ 
        error: `Exception syncing media group: ${error instanceof Error ? error.message : String(error)}`,
        source_message_id: sourceMessageId,
        media_group_id: mediaGroupId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle delayed media group synchronization
 * (for cases where a group is initially received without caption)
 */
async function delayedMediaGroupSync(
  supabase: any,
  mediaGroupId: string,
  correlationId: string,
  logger: any
) {
  try {
    logger.info("Processing delayed media group sync", { 
      media_group_id: mediaGroupId
    });
    
    // Step 1: Find a suitable caption message in the group
    const { data: findResult, error: findError } = await supabase.rpc(
      'xdelo_find_caption_message',
      { p_media_group_id: mediaGroupId }
    );
    
    if (findError) {
      logger.error("Error finding caption message", {
        media_group_id: mediaGroupId,
        error: findError.message
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Error finding caption message: ${findError.message}`,
          media_group_id: mediaGroupId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // If no suitable caption message found
    if (!findResult) {
      logger.info("No caption message found for group", { 
        media_group_id: mediaGroupId 
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "No suitable caption message found in group",
          media_group_id: mediaGroupId
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const sourceMessageId = findResult;
    logger.info("Found caption message for group", { 
      media_group_id: mediaGroupId,
      source_message_id: sourceMessageId
    });
    
    // Step 2: Process the caption of the found message
    const { data: processResult, error: processError } = await supabase.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: sourceMessageId,
        p_correlation_id: correlationId,
        p_force: true
      }
    );
    
    if (processError) {
      logger.error("Error processing caption for delayed sync", {
        media_group_id: mediaGroupId,
        source_message_id: sourceMessageId,
        error: processError.message
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Error processing caption: ${processError.message}`,
          source_message_id: sourceMessageId,
          media_group_id: mediaGroupId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Step 3: Now sync the media group using the processed message
    return await syncMediaGroup(
      supabase,
      sourceMessageId,
      mediaGroupId,
      correlationId,
      true, // Force sync
      true, // Sync edit history
      logger
    );
  } catch (error) {
    logger.error("Exception in delayedMediaGroupSync", {
      media_group_id: mediaGroupId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return new Response(
      JSON.stringify({ 
        error: `Exception in delayed media group sync: ${error instanceof Error ? error.message : String(error)}`,
        media_group_id: mediaGroupId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Reprocess a message completely
 */
async function reprocessMessage(
  supabase: any,
  messageId: string,
  correlationId: string,
  force: boolean,
  logger: any
) {
  try {
    logger.info("Reprocessing message", { 
      message_id: messageId,
      force
    });
    
    // Step 1: Get the message details
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (fetchError) {
      logger.error("Error fetching message for reprocessing", {
        message_id: messageId,
        error: fetchError.message
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Error fetching message: ${fetchError.message}`,
          message_id: messageId
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // If the message has a caption, process it first
    let captionResult = null;
    if (message.caption) {
      // Step 2: Process the caption
      const { data: procResult, error: procError } = await supabase.rpc(
        'xdelo_process_caption_workflow',
        {
          p_message_id: messageId,
          p_correlation_id: correlationId,
          p_force: true
        }
      );
      
      if (procError) {
        logger.error("Error processing caption during reprocessing", {
          message_id: messageId,
          error: procError.message
        });
        
        captionResult = { error: procError.message };
      } else {
        captionResult = procResult;
      }
    }
    
    // If the message is part of a media group, sync the group
    let syncResult = null;
    if (message.media_group_id) {
      // Step 3: Sync the media group if this message has analyzed content
      if (message.analyzed_content || (captionResult && !captionResult.error)) {
        const { data: syncData, error: syncError } = await supabase.rpc(
          'xdelo_sync_media_group_content',
          {
            p_source_message_id: messageId,
            p_media_group_id: message.media_group_id,
            p_correlation_id: correlationId,
            p_force_sync: true,
            p_sync_edit_history: true
          }
        );
        
        if (syncError) {
          logger.error("Error syncing media group during reprocessing", {
            message_id: messageId,
            media_group_id: message.media_group_id,
            error: syncError.message
          });
          
          syncResult = { error: syncError.message };
        } else {
          syncResult = syncData;
        }
      }
    }
    
    logger.info("Reprocessing complete", {
      message_id: messageId,
      caption_result: captionResult,
      sync_result: syncResult
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Message reprocessed successfully",
        message_id: messageId,
        caption_result: captionResult,
        sync_result: syncResult,
        media_group_id: message.media_group_id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logger.error("Exception in reprocessMessage", {
      message_id: messageId,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return new Response(
      JSON.stringify({ 
        error: `Exception reprocessing message: ${error instanceof Error ? error.message : String(error)}`,
        message_id: messageId
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
