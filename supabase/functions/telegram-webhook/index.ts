
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "./utils/cors.ts";
import { handleMediaMessage } from "./handlers/mediaMessageHandler.ts";
import { handleOtherMessage } from "./handlers/textMessageHandler.ts";
import { handleEditedMessage } from "./handlers/editedMessageHandler.ts";
import { createLoggerWithErrorHandling } from "./utils/logger.ts";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

/**
 * Check if a message contains media
 */
function hasMedia(message: any): boolean {
  return !!(message.photo || message.video || message.document);
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
    logger.info("Received webhook payload", { payload_keys: Object.keys(payload) });
    
    // Determine the type of update (message, edited_message, channel_post, etc.)
    let message;
    let isChannelPost = false;
    let isEdit = false;
    
    if (payload.message) {
      message = payload.message;
    } else if (payload.edited_message) {
      message = payload.edited_message;
      isEdit = true;
    } else if (payload.channel_post) {
      message = payload.channel_post;
      isChannelPost = true;
    } else if (payload.edited_channel_post) {
      message = payload.edited_channel_post;
      isChannelPost = true;
      isEdit = true;
    } else {
      logger.info("Unsupported webhook type", { 
        payload_type: Object.keys(payload)[0] 
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
      startTime: new Date().toISOString(),
      logger
    };
    
    // Important: Check for media first, regardless of whether it's an edit or not
    if (hasMedia(message)) {
      logger.logRouting(message.message_id, "media", true, isEdit);
      return await handleMediaMessage(message, context);
    }
    
    // For edits of non-media messages
    if (isEdit) {
      logger.logRouting(message.message_id, "edited", false, true);
      return await handleEditedMessage(message, context);
    }
    
    // For regular non-media messages
    logger.logRouting(message.message_id, "text", false, false);
    return await handleOtherMessage(message, context);
    
  } catch (error) {
    logger.error("Error processing webhook", {
      error: error.message,
      stack: error.stack
    });
    
    return handleError(error);
  }
});
