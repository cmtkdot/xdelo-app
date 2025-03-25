
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';
import { createEdgeHandler, HandlerContext, createErrorResponse } from '../_shared/edgeHandler.ts';

// Create a standardized handler with our configurations
const handler = createEdgeHandler(async (req: Request, context: HandlerContext) => {
  const { logger, correlationId } = context;
  const startTime = new Date().toISOString();
  
  try {
    // Log webhook received event
    logger.info('Webhook received', {
      method: req.method,
      url: req.url,
      correlation_id: correlationId
    });
    
    // Create a unique identifier for this webhook request
    const webhookRequestId = crypto.randomUUID();
    
    // Log webhook received event to database
    await xdelo_logProcessingEvent(
      "webhook_received",
      webhookRequestId,
      correlationId,
      {
        source: "telegram-webhook",
        timestamp: startTime,
        request_id: webhookRequestId
      }
    );

    // Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      logger.info('Received Telegram update', { 
        update_keys: Object.keys(update),
        update_id: update.update_id,
        correlation_id: correlationId
      });
      
      // Log the update data to database
      await xdelo_logProcessingEvent(
        "telegram_update_parsed",
        webhookRequestId,
        correlationId,
        {
          update_id: update.update_id,
          update_keys: Object.keys(update),
          has_message: !!update.message,
          has_edited_message: !!update.edited_message,
          has_channel_post: !!update.channel_post,
          has_edited_channel_post: !!update.edited_channel_post
        }
      );
    } catch (error) {
      logger.error('Failed to parse request body', { error: error.message });
      
      // Log parse error to database
      await xdelo_logProcessingEvent(
        "webhook_parse_error",
        webhookRequestId,
        correlationId,
        {
          error: error.message
        },
        error.message
      );
      
      return createErrorResponse('Invalid JSON in request body', 400, correlationId);
    }

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      logger.warn('No processable content in update', { update_keys: Object.keys(update) });
      
      // Log no message found to database
      await xdelo_logProcessingEvent(
        "webhook_no_message",
        webhookRequestId,
        correlationId,
        {
          update_id: update.update_id,
          update_keys: Object.keys(update)
        }
      );
      
      return createErrorResponse('No processable content', 400, correlationId);
    }

    // Determine message context
    const messageContext = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post,
      logger, // Add logger to context so handlers can use it
      startTime // Track when processing started
    };

    // Create a message identifier
    const messageIdentifier = {
      chat_id: message.chat?.id,
      message_id: message.message_id
    };

    // Log message details with sensitive data masked
    logger.info('Processing message', {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.type,
      is_edit: messageContext.isEdit,
      is_forwarded: messageContext.isForwarded,
      has_media: !!(message.photo || message.video || message.document),
      has_caption: !!message.caption,
      caption_length: message.caption?.length,
      caption_preview: message.caption ? `${message.caption.substring(0, 50)}${message.caption.length > 50 ? '...' : ''}` : null,
      media_group_id: message.media_group_id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'none'
    });

    // Log message routing decision to database
    await xdelo_logProcessingEvent(
      "message_routing_decision",
      webhookRequestId,
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat?.id,
        is_edit: messageContext.isEdit,
        has_media: !!(message.photo || message.video || message.document),
        media_group_id: message.media_group_id,
        handler_type: messageContext.isEdit ? 'edited_message' : 
                    (message.photo || message.video || message.document) ? 'media_message' : 'other_message'
      }
    );

    // Handle different message types
    let response;
    
    try {
      // Handle edited messages
      if (messageContext.isEdit) {
        logger.info('Routing to edited message handler', { 
          message_id: message.message_id,
          correlation_id: correlationId 
        });
        response = await handleEditedMessage(message, messageContext);
      }
      // Handle media messages (photos, videos, documents)
      else if (message.photo || message.video || message.document) {
        logger.info('Routing to media message handler', { 
          message_id: message.message_id,
          correlation_id: correlationId 
        });
        response = await handleMediaMessage(message, messageContext);
      }
      // Handle other types of messages
      else {
        logger.info('Routing to text message handler', { 
          message_id: message.message_id,
          correlation_id: correlationId 
        });
        response = await handleOtherMessage(message, messageContext);
      }
      
      // Calculate processing time
      const processingTimeMs = Date.now() - new Date(startTime).getTime();
      
      logger.info('Successfully processed message', { 
        message_id: message.message_id,
        chat_id: message.chat?.id,
        processing_time_ms: processingTimeMs,
        correlation_id: correlationId
      });
      
      // Log webhook completion to database
      await xdelo_logProcessingEvent(
        "webhook_completed",
        webhookRequestId,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          processing_time_ms: processingTimeMs,
          result: "success",
          request_id: webhookRequestId
        }
      );
      
      // Return the response directly - the edge handler will handle CORS and wrapping
      return response;
      
    } catch (handlerError) {
      logger.error('Error in message handler', { 
        error: handlerError.message,
        stack: handlerError.stack,
        message_id: message.message_id,
        correlation_id: correlationId
      });
      
      // Log the error to the database
      await xdelo_logProcessingEvent(
        "message_processing_failed",
        webhookRequestId,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          is_edit: messageContext.isEdit,
          has_media: !!(message.photo || message.video || message.document),
          handler_type: messageContext.isEdit ? 'edited_message' : 
                       (message.photo || message.video || message.document) ? 'media_message' : 'other_message',
          error: handlerError.message,
          error_stack: handlerError.stack,
          processing_time_ms: Date.now() - new Date(startTime).getTime(),
          request_id: webhookRequestId
        },
        handlerError.message || "Unknown handler error"
      );
      
      // Return error response but with 200 status to acknowledge to Telegram
      // (Telegram will retry if we return non-200 status)
      return createErrorResponse(handlerError.message || 'Handler error', 200, correlationId);
    }
  } catch (error) {
    logger.error('Unhandled error processing webhook', { 
      error: error.message,
      stack: error.stack,
      correlation_id: correlationId
    });
    
    // Log unhandled error to database
    try {
      await xdelo_logProcessingEvent(
        "webhook_unhandled_error",
        crypto.randomUUID(),
        correlationId,
        {
          error: error.message,
          error_stack: error.stack,
          processing_time_ms: Date.now() - new Date(startTime).getTime()
        },
        error.message || "Unknown unhandled error"
      );
    } catch (logError) {
      logger.error('Failed to log unhandled error', {
        original_error: error.message,
        log_error: logError.message
      });
    }
    
    return createErrorResponse(error.message || 'Unknown error', 500, correlationId);
  }
}, {
  functionName: 'telegram-webhook',
  enableCors: true,
  enableLogging: true,
  logRequests: true,
  logResponses: true
});

// Serve the handler
serve(handler);
