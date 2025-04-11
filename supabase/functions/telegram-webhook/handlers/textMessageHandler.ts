import { supabaseClient } from "../../_shared/cors.ts";
// Local Imports
import { MessageContext, TelegramMessage } from '../types.ts';
// Import DB operations
import {
    extractForwardInfo,
    logProcessingEvent,
    upsertTextMessageRecord
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
 * Handles new non-media (text) messages from Telegram.
 * Assumes edited messages are routed to handleEditedMessage.
 * Inserts a new record into the other_messages table using the upsert_text_message PostgreSQL function.
 */
export async function handleOtherMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context;
  const functionName = 'handleOtherMessage';
  let dbMessageId: string | undefined = undefined;

  logWithCorrelation(correlationId, `Processing text message ${message.message_id}`, 'INFO', functionName);

  try {
    // Basic Validation - but ensure we can still save partial data
    if (!message) {
      const errorMessage = `Invalid text message structure: Message object is null or undefined`;
      logWithCorrelation(correlationId, errorMessage, 'ERROR', functionName);
      return createErrorResponse(errorMessage, functionName, 400, correlationId, {});
    }
    
    // Even with missing fields, we'll attempt to store the raw message
    const messageId = message.message_id || 0;
    const chatId = message.chat?.id || 0;
    
    if (!messageId || !chatId) {
      logWithCorrelation(correlationId, `Warning: Missing critical fields (message_id: ${messageId}, chat_id: ${chatId}), but will attempt to store data anyway`, 'WARN', functionName);
    }

    // Extract forward information if this is a forwarded message
    const forwardInfo = extractForwardInfo(message);
    const isForwarded = !!forwardInfo;
    
    // Log forwarded message details if applicable
    if (isForwarded) {
      logWithCorrelation(
        correlationId, 
        `Processing forwarded message from ${forwardInfo?.fromChatId || 'unknown source'} (original msg ID: ${forwardInfo?.fromMessageId || 'unknown'})`, 
        'INFO', 
        functionName
      );
    }
    
    // Use our upsertTextMessageRecord function with simplified parameters
    // Focusing only on essential fields, with telegram_data as the fallback
    logWithCorrelation(correlationId, `Upserting text message record for telegram_message_id: ${messageId}`, 'INFO', functionName);
    
    // Determine message type based on content
    const messageType = message.text ? "text" : 
                      message.sticker ? "sticker" : 
                      message.poll ? "poll" : 
                      message.contact ? "contact" : "unknown";
    
    const upsertResult = await upsertTextMessageRecord({
      supabaseClient,
      messageId: messageId,
      chatId: chatId,
      messageText: message.text || null,
      messageData: message, // Complete webhook data as fallback
      messageType: messageType,
      chatType: message.chat?.type || null,
      chatTitle: message.chat?.title || null,
      forwardInfo: forwardInfo,
      processingState: 'pending_analysis',
      correlationId
    });

    // Handle upsert result
    if (!upsertResult.success) {
      logWithCorrelation(correlationId, `Failed to upsert text message: ${upsertResult.error}`, 'ERROR', functionName);
      await logProcessingEvent(
        supabaseClient,
        "db_upsert_text_failed", 
        null, 
        correlationId,
        { 
          function: functionName, 
          telegram_message_id: messageId, 
          chat_id: chatId 
        },
        upsertResult.error ?? 'Unknown DB error during upsert'
      );
      
      return createErrorResponse(
        `DB error upserting text message: ${upsertResult.error}`, 
        functionName, 
        500, 
        correlationId, 
        {
          messageId: message.message_id,
          chatId: message.chat.id
        }
      );
    }

    // Get the message ID from the result
    dbMessageId = upsertResult.data?.id;
    if (!dbMessageId) {
      logWithCorrelation(correlationId, `Upsert succeeded but no ID returned`, 'ERROR', functionName);
      await logProcessingEvent(
        supabaseClient,
        "db_upsert_text_no_id", 
        null, 
        correlationId,
        { 
          function: functionName, 
          telegram_message_id: messageId, 
          chat_id: chatId 
        },
        'Upsert reported success but returned no record ID'
      );
      
      return createErrorResponse(
        `DB upsert succeeded but failed to return ID`, 
        functionName, 
        500, 
        correlationId, 
        {
          messageId: message.message_id,
          chatId: message.chat.id
        }
      );
    }

    logWithCorrelation(correlationId, `Successfully upserted text message, DB ID: ${dbMessageId}`, 'INFO', functionName);
    await logProcessingEvent(
      supabaseClient,
      isForwarded ? "forwarded_text_message_received" : "text_message_received", 
      dbMessageId, 
      correlationId,
      { 
        is_forwarded: isForwarded,
        forward_source: isForwarded ? forwardInfo?.fromChatId : null,
        function: functionName, 
        telegram_message_id: messageId, 
        chat_id: chatId,
        is_forward: !!message.forward_date
      },
      null // No specific message needed for success
    );

    // Return success response
    return new Response(
      JSON.stringify({
        success: true, 
        operation: 'upserted', 
        messageId: dbMessageId, 
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
    logWithCorrelation(correlationId, `Exception processing text message: ${errorMessage}`, 'ERROR', functionName);
    
    await logProcessingEvent(
      supabaseClient,
      "text_handler_exception", 
      dbMessageId, 
      correlationId,
      { 
        function: functionName, 
        telegram_message_id: message?.message_id || 0, 
        chat_id: message?.chat?.id || 0 
      },
      errorMessage
    );
    
    return createErrorResponse(
      `Exception processing text message: ${errorMessage}`,
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
