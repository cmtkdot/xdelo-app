import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { corsHeaders, handleOptionsRequest, createCorsResponse } from '../_shared/cors.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest();
  }

  // 2. Generate correlation ID
  const correlationId = crypto.randomUUID();

  try {
    // 3. Log webhook received event
    await xdelo_logProcessingEvent(
      "webhook_received",
      "system",
      correlationId,
      {
        source: "telegram-webhook",
        timestamp: new Date().toISOString()
      }
    );

    // 4. Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      console.log(`[${correlationId}] Received Telegram update: ${JSON.stringify(Object.keys(update))}`);
    } catch (error) {
      console.error(`[${correlationId}] Failed to parse request body:`, error);
      return createCorsResponse({
        success: false, 
        error: 'Invalid JSON in request body',
        correlationId
      }, { status: 400 });
    }

    // 5. Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      console.log(`[${correlationId}] No processable content in update:`, Object.keys(update));
      return createCorsResponse({
        success: false, 
        message: "No processable content",
        correlationId
      }, { status: 400 });
    }

    // 6. Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post
    };

    // 7. Log the message type we're about to process
    console.log(`[${correlationId}] Processing message ${message.message_id} in chat ${message.chat?.id}, ` +
      `is_edit: ${context.isEdit}, is_forwarded: ${context.isForwarded}, ` +
      `has_media: ${!!(message.photo || message.video || message.document)}`);

    // 8. Handle different message types
    let response;
    
    try {
      // Handle edited messages
      if (context.isEdit) {
        response = await handleEditedMessage(message, context);
      }
      // Handle media messages (photos, videos, documents)
      else if (message.photo || message.video || message.document) {
        response = await handleMediaMessage(message, context);
      }
      // Handle other types of messages
      else {
        response = await handleOtherMessage(message, context);
      }
      
      console.log(`[${correlationId}] Successfully processed message ${message.message_id} in chat ${message.chat?.id}`);
      
      return response;
    } catch (handlerError) {
      console.error(`[${correlationId}] Error in message handler:`, handlerError);
      
      // Log the error to the database
      await xdelo_logProcessingEvent(
        "message_processing_failed",
        message.message_id.toString(),
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          is_edit: context.isEdit,
          has_media: !!(message.photo || message.video || message.document),
          handler_type: context.isEdit ? 'edited_message' : 
                       (message.photo || message.video || message.document) ? 'media_message' : 'other_message'
        },
        handlerError.message || "Unknown handler error"
      );
      
      // Return error response with 200 status to acknowledge to Telegram
      return createCorsResponse({
        success: false, 
        error: handlerError.message,
        correlationId
      }, { status: 200 }); // Still return 200 to prevent Telegram from retrying
    }
  } catch (error) {
    console.error('Unhandled error processing webhook:', error);
    return createCorsResponse({
      success: false, 
      error: error.message || 'Unknown error',
      correlationId
    }, { status: 500 });
  }
});
