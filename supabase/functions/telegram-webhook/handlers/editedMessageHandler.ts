import { supabaseClient } from "../../_shared/cors.ts";
import { MessageContext, TelegramMessage } from '../types.ts';
// Import DB operations
import {
  findMessageByTelegramId,
  logProcessingEvent,
  updateMessageRecord
} from '../utils/dbOperations.ts';
import { logWithCorrelation } from '../utils/logger.ts';

// Helper function to create consistent error responses
function createErrorResponse(
  message: string,
  functionName: string,
  statusCode: number,
  correlationId: string,
  metadata?: Record<string, any>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      function: functionName,
      correlationId,
      ...metadata
    }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Handles edited messages from Telegram.
 * If the original message is found, updates it.
 * If not found, returns metadata for fallback processing.
 */
export async function handleEditedMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response | { messageNotFound: boolean; messageType: string }> {
  const { correlationId } = context;
  const functionName = 'handleEditedMessage';

  logWithCorrelation(correlationId, `Processing edited message ${message.message_id}`, 'INFO', functionName);

  try {
    // Basic Validation
    if (!message) {
      const errorMessage = `Invalid edited message structure: Message object is null or undefined`;
      logWithCorrelation(correlationId, errorMessage, 'ERROR', functionName);
      return createErrorResponse(errorMessage, functionName, 400, correlationId, {});
    }
    
    // Even with missing fields, we'll attempt to store the raw message
    const messageId = message.message_id || 0;
    const chatId = message.chat?.id || 0;
    
    if (!messageId || !chatId) {
      logWithCorrelation(correlationId, `Warning: Missing critical fields (message_id: ${messageId}, chat_id: ${chatId})`, 'WARN', functionName);
    }

    // Check if the original message exists in our database
    const { success: messageFound, message: existingMessage } = await findMessageByTelegramId(
      supabaseClient,
      messageId,
      chatId,
      correlationId
    );

    // Determine message type for potential fallback routing
    const messageType = message.text ? "text" : 
                       message.photo ? "photo" : 
                       message.video ? "video" : 
                       message.document ? "document" :
                       message.sticker ? "sticker" : 
                       message.poll ? "poll" : 
                       message.contact ? "contact" : "unknown";

    // If the message wasn't found, return metadata for fallback processing
    if (!messageFound || !existingMessage) {
      logWithCorrelation(correlationId, `Original message ${messageId} not found, returning for fallback processing`, 'INFO', functionName);
      
      await logProcessingEvent(
        supabaseClient,
        "edited_message_not_found", 
        null, 
        correlationId,
        { 
          function: functionName, 
          telegram_message_id: messageId, 
          chat_id: chatId,
          message_type: messageType
        },
        "Original message not found, will fallback to processing as new message"
      );
      
      // Return metadata for fallback processing
      return {
        messageNotFound: true,
        messageType
      };
    }

    // Original message found - handle the edit
    logWithCorrelation(correlationId, `Found original message ${messageId}, updating record`, 'INFO', functionName);

    // Here would be the logic to update the existing message record
    // For example:
    const updateResult = await updateMessageRecord(
      supabaseClient,
      existingMessage,
      message,
      null, // No new media info for text edits
      message.text ? { content: message.text } : null,
      correlationId,
      {
        processing_state: 'edited',
        edit_count: (existingMessage.edit_count || 0) + 1,
        last_edited_at: new Date().toISOString()
      }
    );

    if (!updateResult) {
      const errorMessage = `Failed to update message record for edit`;
      logWithCorrelation(correlationId, errorMessage, 'ERROR', functionName);
      
      await logProcessingEvent(
        supabaseClient,
        "edited_message_update_failed", 
        existingMessage.id, 
        correlationId,
        { 
          function: functionName, 
          telegram_message_id: messageId, 
          chat_id: chatId 
        },
        "Failed to update message record for edit"
      );
      
      return createErrorResponse(errorMessage, functionName, 500, correlationId, {
        messageId,
        chatId
      });
    }

    // Log successful update
    await logProcessingEvent(
      supabaseClient,
      "message_edit_processed", 
      existingMessage.id, 
      correlationId,
      { 
        function: functionName, 
        telegram_message_id: messageId, 
        chat_id: chatId 
      },
      null // No error
    );

    // Return success response
    return new Response(
      JSON.stringify({
        success: true, 
        operation: 'updated', 
        messageId: existingMessage.id, 
        correlationId
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception processing edited message: ${errorMessage}`, 'ERROR', functionName);
    
    await logProcessingEvent(
      supabaseClient,
      "edited_message_handler_exception", 
      null, 
      correlationId,
      { 
        function: functionName, 
        telegram_message_id: message?.message_id || 0, 
        chat_id: message?.chat?.id || 0 
      },
      errorMessage
    );
    
    return createErrorResponse(
      `Exception processing edited message: ${errorMessage}`,
      functionName,
      500,
      correlationId,
      {
        messageId: message?.message_id,
        chatId: message?.chat?.id
      }
    );
  }
}
