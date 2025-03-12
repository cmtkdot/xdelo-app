
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getLogger } from './utils/logger.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Generate correlation ID for this request
    const correlationId = crypto.randomUUID();
    const logger = getLogger(correlationId);
    
    logger.info(`Processing webhook request`, { timestamp: new Date().toISOString() });

    // Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      logger.info('Received Telegram update', { 
        update_type: Object.keys(update).join(','),
        correlation_id: correlationId  
      });
    } catch (error) {
      logger.error('Failed to parse request body', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON in request body' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      logger.info('No processable content in update', { update_keys: Object.keys(update) });
      return new Response(JSON.stringify({ 
        success: false, 
        message: "No processable content" 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post
    };

    // Log the message type we're about to process
    logger.info('Processing message', {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      is_edit: context.isEdit,
      is_forwarded: context.isForwarded,
      is_channel_post: context.isChannelPost,
      has_photo: !!message.photo,
      has_video: !!message.video,
      has_document: !!message.document,
      has_caption: !!message.caption
    });

    // Handle different message types
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
      
      logger.info('Successfully processed message', {
        message_id: message.message_id,
        chat_id: message.chat?.id
      });
      
      return response;
    } catch (handlerError) {
      logger.error(`Error in message handler: ${handlerError.message}`, handlerError);
      
      // Return error response but with 200 status to acknowledge to Telegram
      // (Telegram will retry if we return non-200 status)
      return new Response(JSON.stringify({ 
        success: false, 
        error: handlerError.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent Telegram from retrying
      });
    }

  } catch (error) {
    console.error('Unhandled error processing webhook:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
