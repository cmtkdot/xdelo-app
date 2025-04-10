/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse, supabaseClient } from "../../_shared/cors.ts";
import { constructTelegramMessageUrl } from "../../_shared/messageUtils.ts";
// Local Imports
import { MessageContext, TelegramMessage } from '../types.ts';
// Import the specific DB operations needed
import {
  upsertTextMessageRecord,
  extractForwardInfo,
  logProcessingEvent,
  createErrorResponse,
  logWithCorrelation,
  DbOperationResult
} from '../utils/dbOperations.ts';

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
    // Basic Validation
    if (!message || !message.chat || !message.message_id || !message.date) {
      const errorMessage = `Invalid text message structure: Missing required fields`;
      logWithCorrelation(correlationId, errorMessage, 'ERROR', functionName);
      return createErrorResponse(errorMessage, functionName, 400, correlationId, {
        messageId: message?.message_id,
        chatId: message?.chat?.id
      });
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
    
    // Use our new upsertTextMessageRecord function
    logWithCorrelation(correlationId, `Upserting text message record for telegram_message_id: ${message.message_id}`, 'INFO', functionName);
    const upsertResult = await upsertTextMessageRecord({
      supabaseClient,
      messageId: message.message_id,
      chatId: message.chat.id,
      messageText: message.text,
      messageData: message, // Store as telegram_data in PostgreSQL
      chatType: message.chat.type,
      chatTitle: message.chat.title,
      forwardInfo: forwardInfo,
      correlationId
    });

    // Handle upsert result
    if (!upsertResult.success) {
      logWithCorrelation(correlationId, `Failed to upsert text message: ${upsertResult.error}`, 'ERROR', functionName);
      await logProcessingEvent(
        "db_upsert_text_failed", 
        null, 
        correlationId,
        { 
          function: functionName, 
          telegram_message_id: message.message_id, 
          chat_id: message.chat.id 
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
        "db_upsert_text_no_id", 
        null, 
        correlationId,
        { 
          function: functionName, 
          telegram_message_id: message.message_id, 
          chat_id: message.chat.id 
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
      isForwarded ? "forwarded_text_message_received" : "text_message_received", 
      dbMessageId, 
      correlationId,
      { 
        is_forwarded: isForwarded,
        forward_source: isForwarded ? forwardInfo?.fromChatId : null,
        function: functionName, 
        telegram_message_id: message.message_id, 
        chat_id: message.chat.id,
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
      "text_handler_exception", 
      dbMessageId, 
      correlationId,
      { 
        function: functionName, 
        telegram_message_id: message?.message_id, 
        chat_id: message?.chat?.id 
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
