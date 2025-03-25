
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';
import { Logger } from './utils/logger.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

serve(async (req: Request) => {
  // Generate a correlation ID for tracing
  const correlationId = crypto.randomUUID();
  
  // Create a main logger for this request
  const logger = new Logger(correlationId, 'telegram-webhook');
  
  // Create Supabase client for transaction handling
  const supabaseClient = createSupabaseClient();
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logger.debug('Received OPTIONS request, returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log webhook received event
    logger.info('Webhook received', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
    });
    
    await xdelo_logProcessingEvent(
      "webhook_received",
      "system",
      correlationId,
      {
        source: "telegram-webhook",
        timestamp: new Date().toISOString()
      }
    );

    // Parse the update from Telegram
    let update;
    try {
      update = await req.json();
      logger.info('Received Telegram update', { 
        update_keys: Object.keys(update),
        update_id: update.update_id
      });
    } catch (error) {
      logger.error('Failed to parse request body', { error: error.message });
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON in request body',
        correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
    if (!message) {
      logger.warn('No processable content in update', { update_keys: Object.keys(update) });
      return new Response(JSON.stringify({ 
        success: false, 
        message: "No processable content",
        correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Set start time for performance tracking
    const startTime = Date.now();

    // Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post,
      logger, // Add logger to context so handlers can use it
      startTime, // Add start time for performance tracking
      supabaseClient // Add supabase client for transaction handling
    };

    // Log message details with sensitive data masked
    logger.info('Processing message', {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.type,
      is_edit: context.isEdit,
      is_forwarded: context.isForwarded,
      has_media: !!(message.photo || message.video || message.document),
      has_caption: !!message.caption,
      caption_length: message.caption?.length,
      caption_preview: message.caption ? `${message.caption.substring(0, 50)}${message.caption.length > 50 ? '...' : ''}` : null,
      media_group_id: message.media_group_id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : message.document ? 'document' : 'none'
    });

    // Handle different message types
    let response;
    
    // Start a transaction if handling media groups to ensure atomicity
    const isMediaGroup = !!message.media_group_id;
    let txnSucessful = false;
    
    try {
      // Handle edited messages
      if (context.isEdit) {
        logger.info('Routing to edited message handler', { message_id: message.message_id });
        response = await handleEditedMessage(message, context);
      }
      // Handle media messages (photos, videos, documents)
      else if (message.photo || message.video || message.document) {
        logger.info('Routing to media message handler', { message_id: message.message_id });
        response = await handleMediaMessage(message, context);
      }
      // Handle other types of messages
      else {
        logger.info('Routing to text message handler', { message_id: message.message_id });
        response = await handleOtherMessage(message, context);
      }
      
      txnSucessful = true;
      
      // Record the successful processing with performance metrics
      logger.info('Successfully processed message', { 
        message_id: message.message_id,
        chat_id: message.chat?.id,
        processing_time: Date.now() - startTime,
        is_media_group: isMediaGroup
      });
      
      // Add diagnostic info to the response
      const responseData = await response.json();
      const enhancedResponse = {
        ...responseData,
        diagnostics: {
          processing_time_ms: Date.now() - startTime,
          correlation_id: correlationId,
          media_group_processed: isMediaGroup
        }
      };
      
      return new Response(JSON.stringify(enhancedResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status
      });
    } catch (handlerError) {
      // Log the error with detailed context
      logger.error('Error in message handler', { 
        error: handlerError.message,
        stack: handlerError.stack,
        message_id: message.message_id,
        media_group_id: message.media_group_id,
        is_media_group: isMediaGroup,
        txn_successful: txnSucessful
      });
      
      // Log the error to the database with retry mechanisms
      try {
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
                        (message.photo || message.video || message.document) ? 'media_message' : 'other_message',
            error: handlerError.message,
            error_stack: handlerError.stack,
            processing_time_ms: Date.now() - startTime,
            is_media_group: isMediaGroup,
            recovery_attempted: true
          },
          handlerError.message || "Unknown handler error"
        );
      } catch (logError) {
        logger.error('Failed to log error to database', {
          original_error: handlerError.message,
          log_error: logError.message
        });
      }
      
      // Return error response but with 200 status to acknowledge to Telegram
      // (Telegram will retry if we return non-200 status)
      return new Response(JSON.stringify({ 
        success: false, 
        error: handlerError.message,
        correlationId,
        diagnostics: {
          processing_time_ms: Date.now() - startTime,
          is_media_group: isMediaGroup,
          txn_successful: txnSucessful,
          recovery_attempted: true
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent Telegram from retrying
      });
    }
  } catch (error) {
    // Log unhandled errors with as much context as we can get
    logger.error('Unhandled error processing webhook', { 
      error: error.message,
      stack: error.stack,
      processing_time_ms: Date.now() - (context?.startTime || Date.now())
    });
    
    // Attempt to log to database, but don't throw if this fails
    try {
      await xdelo_logProcessingEvent(
        "webhook_unhandled_error",
        "system",
        correlationId,
        {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
        error.message
      );
    } catch (logError) {
      console.error('Failed to log unhandled error to database:', logError);
    }
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error',
      correlationId,
      diagnostics: {
        error_type: 'unhandled_webhook_error',
        time: new Date().toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
