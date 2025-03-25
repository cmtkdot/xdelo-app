
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "./utils/cors.ts";
import { handleMediaMessage } from "./handlers/mediaMessageHandler.ts";
import { handleOtherMessage } from "./handlers/textMessageHandler.ts";
import { handleEditedMessage } from "./handlers/editedMessageHandler.ts";
import { createLoggerWithErrorHandling } from "./utils/logger.ts";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";
import { xdelo_processDelayedMediaGroupSync } from "./utils/databaseOperations.ts";

/**
 * Check if a message contains media
 */
export function hasMedia(message: any): boolean {
  return !!(message.photo || message.video || message.document);
}

/**
 * Check if a message has actual text content
 */
export function hasText(message: any): boolean {
  return typeof message.text === 'string' && message.text.trim().length > 0;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Generate correlation ID for this request
  const correlationId = uuidv4();
  
  // Create logger for this request
  const { logger, handleError } = createLoggerWithErrorHandling(correlationId, "telegram-webhook");
  
  try {
    // Parse the incoming webhook payload
    const payload = await req.json();
    logger.info("Received webhook payload", { 
      payload_keys: Object.keys(payload),
      correlation_id: correlationId
    });
    
    // Determine the type of update (message, edited_message, channel_post, etc.)
    let message;
    let isChannelPost = false;
    let isEdit = false;
    let previousMessage = null;
    
    if (payload.message) {
      message = payload.message;
    } else if (payload.edited_message) {
      message = payload.edited_message;
      isEdit = true;
      previousMessage = payload.edited_message;
    } else if (payload.channel_post) {
      message = payload.channel_post;
      isChannelPost = true;
    } else if (payload.edited_channel_post) {
      message = payload.edited_channel_post;
      isChannelPost = true;
      isEdit = true;
      previousMessage = payload.edited_channel_post;
    } else {
      logger.info("Unsupported webhook type", { 
        payload_type: Object.keys(payload)[0],
        correlation_id: correlationId
      });
      
      return new Response(
        JSON.stringify({ success: true, message: "Unsupported webhook type" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }
    
    // Check if this is a forwarded message
    const isForwarded = !!(
      message.forward_date || 
      message.forward_from || 
      message.forward_from_chat || 
      message.forward_origin
    );
    
    // Create context object for handlers
    const context = {
      isChannelPost,
      isForwarded,
      correlationId,
      isEdit,
      previousMessage,
      startTime: new Date().toISOString(),
      logger
    };
    
    // Process delayed media group sync if needed
    if (message.media_group_id && !isEdit) {
      // Start a background task to process delayed media group sync
      // This ensures that even if the initial message doesn't have caption,
      // we'll sync the group later
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            logger.info("Starting delayed media group sync in background", {
              media_group_id: message.media_group_id,
              message_id: message.message_id,
              correlation_id: correlationId
            });
            
            // Wait a short delay to allow other messages in the group to arrive
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // Process the delayed sync
            await xdelo_processDelayedMediaGroupSync(message.media_group_id, correlationId);
          } catch (err) {
            logger.error("Error in delayed media group sync background task", {
              media_group_id: message.media_group_id,
              error: err.message
            });
          }
        })()
      );
    }
    
    // IMPORTANT: Check for media first, regardless of whether it's an edit or not
    // This ensures all media messages go to the media handler
    if (hasMedia(message)) {
      logger.info("Routing message to media handler", { 
        message_id: message.message_id, 
        has_media: true, 
        is_edit: isEdit,
        correlation_id: correlationId
      });
      return await handleMediaMessage(message, context);
    }
    
    // For edits of non-media messages
    if (isEdit) {
      logger.info("Routing message to edited handler", { 
        message_id: message.message_id, 
        has_media: false, 
        is_edit: true,
        correlation_id: correlationId
      });
      return await handleEditedMessage(message, context);
    }
    
    // For regular non-media messages
    logger.info("Routing message to text handler", { 
      message_id: message.message_id, 
      has_media: false, 
      is_edit: false,
      correlation_id: correlationId
    });
    return await handleOtherMessage(message, context);
    
  } catch (error) {
    logger.error("Error processing webhook", {
      error: error.message,
      stack: error.stack,
      correlation_id: correlationId
    });
    
    return handleError(error);
  }
});
