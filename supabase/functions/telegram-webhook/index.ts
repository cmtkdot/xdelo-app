
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleMediaMessage } from './handlers/mediaMessageHandler.ts';
import { handleOtherMessage, handleEditedMessage } from './handlers/textMessageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { withErrorHandling, SecurityLevel } from '../_shared/errorHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';

// Main handler function wrapped with error handling
serve(withErrorHandling(
  'telegram-webhook',
  async (req: Request, correlationId: string) => {
    try {
      // Create Supabase client for database operations
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );

      // Log webhook received event using shared utility
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
        console.log(`[${correlationId}] Received Telegram update: ${JSON.stringify(Object.keys(update))}`);
      } catch (error) {
        console.error(`[${correlationId}] Failed to parse request body:`, error);
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
        console.log(`[${correlationId}] No processable content in update:`, Object.keys(update));
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
        previousMessage: update.edited_message || update.edited_channel_post
      };

      // Log the message type we're about to process
      console.log(`[${correlationId}] Processing message ${message.message_id} in chat ${message.chat?.id}, ` +
        `is_edit: ${context.isEdit}, is_forwarded: ${context.isForwarded}, ` +
        `has_media: ${!!(message.photo || message.video || message.document)}`);

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
        
        console.log(`[${correlationId}] Successfully processed message ${message.message_id} in chat ${message.chat?.id}`);
        
        return response;
      } catch (handlerError) {
        console.error(`[${correlationId}] Error in message handler:`, handlerError);
        
        // Log the error to the database using the shared utility
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
      console.error('Unhandled error processing webhook:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
        correlationId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }
  },
  { securityLevel: SecurityLevel.SERVICE_ROLE }
));
