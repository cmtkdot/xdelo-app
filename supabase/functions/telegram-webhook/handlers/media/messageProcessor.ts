
import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { 
  TelegramMessage, 
  MessageContext
} from '../../types.ts';
import { 
  xdelo_logProcessingEvent
} from '../../utils/databaseOperations.ts';
import {
  xdelo_processCaptionFromWebhook, 
  xdelo_syncMediaGroupFromWebhook 
} from '../../utils/databaseOperations.ts';

/**
 * Main handler for media messages from Telegram
 */
export async function handleMediaMessage(message: TelegramMessage, context: MessageContext): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage, logger } = context;
    
    // Log the start of processing
    logger?.info(`Processing ${isEdit ? 'edited' : 'new'} media message`, {
      message_id: message.message_id,
      chat_id: message.chat.id
    });
    
    let response;
    
    // Route to the appropriate handler based on whether it's an edit
    if (isEdit && previousMessage) {
      response = await handleEditedMediaMessage(message, context, previousMessage);
    } else {
      response = await handleNewMediaMessage(message, context);
    }
    
    // After successful processing, trigger delayed media group sync if needed
    if (message.media_group_id && response.status === 200) {
      try {
        const responseBody = await response.clone().json();
        
        // If this is a successful message with a caption, trigger media group sync
        if (responseBody.success && message.caption) {
          logger?.info("Starting background media group sync after successful message processing", {
            message_id: message.message_id,
            media_group_id: message.media_group_id,
            message_id_db: responseBody.id || responseBody.messageId
          });
          
          // Use waitUntil to not block the response
          EdgeRuntime.waitUntil(
            (async () => {
              try {
                // Allow some time for other messages in the group to be processed
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Use the unified processor for consistent group syncing
                await xdelo_syncMediaGroupFromWebhook(
                  message.media_group_id,
                  responseBody.id || responseBody.messageId,
                  correlationId,
                  true, // Force sync to ensure it happens
                  false // Don't sync edit history for new messages
                );
                
                logger?.info("Background media group sync completed", {
                  media_group_id: message.media_group_id,
                  source_message_id: responseBody.id || responseBody.messageId
                });
              } catch (syncError) {
                logger?.error("Error in background media group sync", {
                  error: syncError.message,
                  media_group_id: message.media_group_id,
                  source_message_id: responseBody.id || responseBody.messageId
                });
              }
            })()
          );
        }
      } catch (parseError) {
        logger?.warn("Could not parse response for background media group sync", {
          error: parseError.message
        });
      }
    }
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger?.error(`Error processing media message: ${errorMessage}`, {
      error: error instanceof Error ? error : { message: errorMessage },
      message_id: message.message_id,
      chat_id: message.chat?.id
    });
    
    // Also log to database for tracking
    try {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        message.message_id.toString(),
        context.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          error: errorMessage
        },
        errorMessage
      );
    } catch (logError) {
      context.logger?.error(`Failed to log error to database: ${
        logError instanceof Error ? logError.message : String(logError)}`);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

// Import the handlers from their respective files
import { handleEditedMediaMessage } from "./editedMediaHandler.ts";
import { handleNewMediaMessage } from "./newMediaHandler.ts";
