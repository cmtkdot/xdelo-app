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
): Promise<Response | { messageNotFound: boolean; messageType: string; detailedType: string; media: boolean; isRecoveredEdit: boolean }> {
  const { correlationId } = context;
  const functionName = 'handleEditedMessage';
  
  // Adding debug logging at the start
  logWithCorrelation(correlationId, `Looking up original message by tg_msg_id: ${message.message_id}, chat_id: ${message.chat?.id}`, 'DEBUG', functionName);

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

    // Determine message type for potential fallback routing - more detailed for proper handler selection
    const messageType = message.photo || message.video || message.document ? "media" :
                       message.text ? "text" : 
                       message.sticker ? "sticker" : 
                       message.poll ? "poll" : 
                       message.contact ? "contact" : 
                       message.voice ? "voice" :
                       message.audio ? "audio" :
                       message.animation ? "animation" :
                       "unknown";
    
    // For debugging and routing logic
    const detailedType = message.photo ? "photo" :
                       message.video ? "video" :
                       message.document ? "document" :
                       message.text ? "text" :
                       message.sticker ? "sticker" :
                       message.poll ? "poll" :
                       message.contact ? "contact" :
                       message.voice ? "voice" :
                       message.audio ? "audio" :
                       message.animation ? "animation" :
                       "unknown";

    // If the message wasn't found, return metadata for fallback processing
    if (!messageFound || !existingMessage) {
      logWithCorrelation(correlationId, `Original message ${messageId} not found, returning for fallback processing as ${detailedType} message`, 'INFO', functionName);
      
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
      // Include detailed information for proper routing
      return {
        messageNotFound: true,
        messageType,
        detailedType,
        media: messageType === 'media',
        isRecoveredEdit: true // Flag to indicate this is a recovered edit
      };
    }

    // Original message found - handle the edit
    logWithCorrelation(correlationId, `Found original message ${messageId}, updating record`, 'INFO', functionName);
    
    // Debug log with additional details for tracking
    logWithCorrelation(correlationId, `Message details: type=${detailedType}, media=${messageType === 'media'}`, 'DEBUG', functionName);

    // Process caption/content if present
    let contentData = null;
    const hasCaption = !!message.caption;
    const hasText = !!message.text;
    
    if (hasCaption || hasText) {
      // Process caption or text content
      if (hasCaption) {
        logWithCorrelation(correlationId, `Processing caption for edited ${detailedType} message`, 'INFO', functionName);
        // In a real implementation, we'd process the caption here
        contentData = { rawText: message.caption };
      } else if (hasText) {
        logWithCorrelation(correlationId, `Processing text for edited message`, 'INFO', functionName);
        contentData = { content: message.text };
      }
    }

    // Check if caption/content has changed
    const captionChanged = hasCaption && message.caption !== existingMessage.caption;
    const textChanged = hasText && message.text !== existingMessage.text;
    const contentChanged = captionChanged || textChanged;
    
    // Prepare update data
    const updates: Record<string, any> = {
      processing_state: 'edited',
      edit_count: (existingMessage.edit_count || 0) + 1,
      last_edited_at: new Date().toISOString()
    };
    
    // If content has changed, handle old_analyzed_content properly
    if (contentChanged && existingMessage.analyzed_content) {
      logWithCorrelation(correlationId, `Content changed, preserving current analyzed_content in old_analyzed_content field`, 'INFO', functionName);
      // Simply move current analyzed_content to old_analyzed_content (as a single object, not array)
      updates.old_analyzed_content = existingMessage.analyzed_content;
      updates.analyzed_content = contentData;
      updates.processing_state = 'initialized'; // Reset processing state
    }

    const updateResult = await updateMessageRecord(
      supabaseClient,
      existingMessage,
      message,
      null, // No new media info for text edits
      contentData, // Use our processed content data
      correlationId,
      updates
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
