
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Helper function for CORS preflight requests
function handleOptionsRequest() {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  });
}

// Helper function for creating consistent responses
function createResponse(body: any, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status,
    }
  );
}

// Basic handler for text messages
async function handleTextMessage(message: any, context: any) {
  return createResponse({
    success: true,
    message: "Text message received",
    messageId: message.message_id,
    correlationId: context.correlationId
  });
}

// Main webhook handler
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest();
  }

  try {
    // Generate correlation ID for tracking
    const correlationId = crypto.randomUUID();
    
    // Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      console.log(`[${correlationId}] Received Telegram update: ${JSON.stringify(update)}`);
    } catch (error) {
      console.error(`[${correlationId}] Failed to parse request body:`, error);
      return createResponse({
        success: false, 
        error: 'Invalid JSON in request body',
        correlationId
      }, 400);
    }

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    
    if (!message) {
      console.log(`[${correlationId}] No message in update:`, update);
      return createResponse({
        success: false, 
        message: "No message in update",
        correlationId
      }, 400);
    }

    // Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post
    };

    console.log(`[${correlationId}] Processing message ${message.message_id} in chat ${message.chat?.id}`);

    // Handle different message types
    if (message.photo || message.video || message.document) {
      // Handle media messages (photos, videos, documents)
      return await handleMediaMessage(message, context);
    } else {
      // Handle text messages
      return await handleTextMessage(message, context);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return createResponse({
      success: false, 
      error: error.message || 'Unknown error'
    }, 500);
  }
});
