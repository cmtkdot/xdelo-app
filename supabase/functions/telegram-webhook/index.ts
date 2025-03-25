import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';
import { createEdgeHandler, HandlerContext, createErrorResponse } from '../_shared/edgeHandler.ts';
import { createLoggerAdapter } from '../_shared/logger/adapter.ts';

// Create a standardized handler with our configurations
const handler = createEdgeHandler(async (req: Request, context: HandlerContext) => {
  const { logger, correlationId } = context;
  const startTime = new Date().toISOString();
  const loggerAdapter = createLoggerAdapter(logger, correlationId);
  
  // Generate a unique ID for this webhook request once
  const webhookRequestId = crypto.randomUUID();
  
  try {
    // Log webhook received event - just once at the start
    loggerAdapter.info('Webhook received', {
      method: req.method,
      url: req.url,
      webhook_request_id: webhookRequestId
    });
    
    // Log webhook received event to database - just core info
    await xdelo_logProcessingEvent(
      "webhook_received",
      webhookRequestId,
      correlationId,
      {
        timestamp: startTime,
      }
    );

    // Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      loggerAdapter.info('Received Telegram update', { 
        update_id: update.update_id,
        update_keys: Object.keys(update)
      });
    } catch (error) {
      loggerAdapter.error('Failed to parse request body', error);
      return createErrorResponse('Invalid JSON in request body', 400, correlationId);
    }

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      loggerAdapter.warn('No processable content in update', { update_keys: Object.keys(update) });
      return createErrorResponse('No processable content', 400, correlationId);
    }

    // Determine message context - creating this only once
    const messageContext = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post,
      logger,
      startTime
    };

    // Log message details with sensitive data masked, but keep it brief
    loggerAdapter.info('Processing message', {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.type,
      is_edit: messageContext.isEdit,
      is_forwarded: messageContext.isForwarded,
      has_media: !!(message.photo || message.video || message.document),
      has_caption: !!message.caption,
      media_group_id: message.media_group_id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'none'
    });

    // Handle different message types
    let response;
    
    try {
      // Route to appropriate handler based on message type
      if (messageContext.isEdit) {
        loggerAdapter.info('Routing to edited message handler', { message_id: message.message_id });
        response = await handleEditedMessage(message, messageContext);
      } else if (message.photo || message.video || message.document) {
        loggerAdapter.info('Routing to media message handler', { message_id: message.message_id });
        response = await handleMediaMessage(message, messageContext);
      } else {
        loggerAdapter.info('Routing to text message handler', { message_id: message.message_id });
        response = await handleOtherMessage(message, messageContext);
      }
      
      // Calculate processing time
      const processingTimeMs = Date.now() - new Date(startTime).getTime();
      
      loggerAdapter.info('Successfully processed message', { 
        message_id: message.message_id,
        processing_time_ms: processingTimeMs
      });
      
      // Log webhook completion to database with minimal info - do this only once
      await xdelo_logProcessingEvent(
        "webhook_completed",
        webhookRequestId,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          processing_time_ms: processingTimeMs,
          result: "success"
        }
      );
      
      // Return the response directly
      return response;
      
    } catch (handlerError) {
      loggerAdapter.error('Error in message handler', { 
        error: handlerError.message,
        message_id: message.message_id
      });
      
      // Log the error to the database with minimal info - only once
      await xdelo_logProcessingEvent(
        "message_processing_failed",
        webhookRequestId,
        correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          handler_type: messageContext.isEdit ? 'edited_message' : 
                       (message.photo || message.video || message.document) ? 'media_message' : 'other_message',
          error: handlerError.message
        },
        handlerError.message || "Unknown handler error"
      );
      
      // Return error response but with 200 status to acknowledge to Telegram
      return createErrorResponse(handlerError.message || 'Handler error', 200, correlationId);
    }
  } catch (error) {
    loggerAdapter.error('Unhandled error processing webhook', { 
      error: error.message
    });
    
    // Log unhandled error to database with minimal info - only once
    try {
      await xdelo_logProcessingEvent(
        "webhook_unhandled_error",
        webhookRequestId,
        correlationId,
        {
          error: error.message,
          processing_time_ms: Date.now() - new Date(startTime).getTime()
        },
        error.message || "Unknown unhandled error"
      );
    } catch (logError) {
      loggerAdapter.error('Failed to log unhandled error', {
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
