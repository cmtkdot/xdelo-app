import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage } from './handlers/textMessageHandler.ts';
import { handleEditedMessage } from './handlers/editedMessageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';
import { Logger } from './utils/logger.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Create direct Supabase client with service role key
function createDirectSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase credentials in environment');
  }
  
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false // Added to prevent JWT issues
    },
    global: {
      headers: {
        'X-Client-Info': 'telegram-webhook-direct',
      },
    },
  });
}

/**
 * Helper function to process message caption
 */
async function processCaptionAsync(messageId: string, correlationId: string, logger: Logger): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    // Don't wait for the result, just fire the request
    fetch(`${supabaseUrl}/functions/v1/caption-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({
        messageId,
        correlationId
      })
    }).catch(error => {
      logger.error(`Error calling caption processor: ${error.message}`, { messageId });
    });
    
    logger.debug(`Caption processing initiated for message: ${messageId}`);
  } catch (error) {
    logger.error(`Failed to initiate caption processing: ${error.message}`, { messageId });
  }
}

serve(async (req: Request) => {
  // Generate a correlation ID for tracing
  const correlationId = crypto.randomUUID();
  
  // Create a main logger for this request
  const logger = new Logger(correlationId, 'telegram-webhook');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logger.debug('Received OPTIONS request, returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create direct Supabase client
    const directClient = createDirectSupabaseClient();
    
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

    // Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post,
      startTime: Date.now(),
      logger,
      supabase: directClient // Add direct Supabase client to context
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
    
    try {
      // Check if message contains media first
      const hasMedia = !!(message.photo || message.video || message.document);
      
      // Handle media messages (photos, videos, documents) - including edited ones
      if (hasMedia) {
        logger.info('Routing to media message handler', { 
          message_id: message.message_id,
          is_edit: context.isEdit
        });
        response = await handleMediaMessage(message, context);
        
        // Check if a message ID was returned in the response
        try {
          const responseData = await response.json();
          
          // If message has caption, immediately initiate caption processing
          if (message.caption && responseData.success && responseData.id) {
            logger.info('Caption detected, initiating immediate processing', {
              message_id: responseData.id,
              caption_length: message.caption.length
            });
            
            // Initiate caption processing asynchronously (don't await)
            processCaptionAsync(responseData.id, correlationId, logger);
          }
          
          // Reconstruct the response since we consumed it
          response = new Response(JSON.stringify(responseData), {
            headers: response.headers,
            status: response.status
          });
        } catch (parseError) {
          logger.warn('Could not parse media handler response to check for caption', {
            error: parseError.message
          });
          // Continue with original response
        }
      }
      // Handle edited text messages
      else if (context.isEdit) {
        logger.info('Routing to edited message handler', { message_id: message.message_id });
        response = await handleEditedMessage(message, context);
      }
      // Handle other types of messages (text, stickers, etc.)
      else {
        logger.info('Routing to text message handler', { message_id: message.message_id });
        response = await handleOtherMessage(message, context);
      }
      
      logger.info('Successfully processed message', { 
        message_id: message.message_id,
        chat_id: message.chat?.id,
        processing_time: Date.now() - context.startTime
      });
      
      return response;
    } catch (handlerError) {
      logger.error('Error in message handler', { 
        error: handlerError.message,
        stack: handlerError.stack,
        message_id: message.message_id
      });
      
      // Log the error to the database using direct client
      try {
        await directClient.from('unified_audit_logs').insert({
          event_type: "message_processing_failed",
          entity_id: message.message_id.toString(),
          metadata: {
            message_id: message.message_id,
            chat_id: message.chat?.id,
            is_edit: context.isEdit,
            has_media: !!(message.photo || message.video || message.document),
            handler_type: context.isEdit ? 'edited_message' : 
                        (message.photo || message.video || message.document) ? 'media_message' : 'other_message',
            error: handlerError.message,
            error_stack: handlerError.stack,
            correlation_id: correlationId,
            logged_from: 'edge_function_direct'
          },
          error_message: handlerError.message || "Unknown handler error",
          correlation_id: correlationId,
          event_timestamp: new Date().toISOString()
        });
      } catch (logError) {
        logger.error('Failed to log error to database', { error: logError.message });
      }
      
      // Return error response but with 200 status to acknowledge to Telegram
      // (Telegram will retry if we return non-200 status)
      return new Response(JSON.stringify({ 
        success: false, 
        error: handlerError.message,
        correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Still return 200 to prevent Telegram from retrying
      });
    }
  } catch (error) {
    logger.error('Unhandled error processing webhook', { 
      error: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Unknown error',
      correlationId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
