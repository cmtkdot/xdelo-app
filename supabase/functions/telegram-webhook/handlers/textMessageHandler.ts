/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts";
// Removed: import { logAuditEvent } from "../../_shared/dbUtils.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
// Local Imports
import { MessageContext, TelegramMessage, MessageRecord } from '../types.ts';
// Import the specific DB operations needed
import {
  createMessageRecord, // Assuming this is the function to create a record
  logProcessingEvent,       // Assuming logAuditEvent is now here
  DbOperationResult
} from '../utils/dbOperations.ts';

/**
 * Handles new non-media (text) messages from Telegram.
 * Assumes edited messages are routed to handleEditedMessage.
 * Inserts a new record into the 'messages' table using utility functions.
 */
export async function handleOtherMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context;
  const functionName = 'handleOtherMessage';
  let dbMessageId: string | undefined = undefined;

  console.log(`[${correlationId}][${functionName}] Processing text message ${message.message_id}`);

  try {
    // Basic Validation
    if (!message || !message.chat || !message.message_id || !message.text || !message.date) {
      throw new Error(`Invalid text message structure: Missing required fields`);
    }

    // Prepare data for insertion using MessageRecord type
    const messageRecord: Partial<MessageRecord> = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      user_id: message.from?.id,
      username: message.from?.username,
      first_name: message.from?.first_name,
      last_name: message.from?.last_name,
      message_type: 'text', // Explicitly set for text messages
      text_content: message.text,
      // caption: null, // Explicitly null for text
      // analyzed_content: null, // Will be set by analysis later
      message_timestamp: new Date(message.date * 1000).toISOString(),
      // last_edited_at: null,
      // edit_history: [],
      // edit_count: 0,
      // file_id: null,
      // file_unique_id: null,
      // file_size: null,
      // mime_type: null,
      // storage_path: null,
      // public_url: null,
      // dimensions: null,
      // duration: null,
      media_group_id: message.media_group_id,
      processing_state: 'pending_analysis', // Text messages usually need analysis
      retry_count: 0,
      // error_message: null,
      // last_error_at: null,
      telegram_data: message, // Store raw message data
      message_url: constructTelegramMessageUrl(message),
      correlation_id: correlationId,
    };

    // --- Insert the Message Record using Utility Function ---
    console.log(`[${correlationId}][${functionName}] Attempting to create message record for tg_msg_id: ${message.message_id}`);
    const createResult = await createMessageRecord(
      supabaseClient,
      messageRecord,
      correlationId
    );

    // --- Handle Insertion Result ---    
    if (!createResult.success || !createResult.data || createResult.data.length === 0) {
      console.error(`[${correlationId}][${functionName}] Failed to insert text message:`, createResult.error);
      await logProcessingEvent(
          "db_insert_text_failed", null, correlationId,
          { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
          createResult.error ?? 'Unknown DB error during insert'
      );
      // Original logic returned 200 even on DB failure, maintaining that for now
      return createCorsResponse(
        { success: false, error: `DB error inserting text message: ${createResult.error}`, correlationId },
        { status: 200 }
      );
    }

    // Assuming createResult.data[0] contains the inserted record with its ID
    // Adjust based on the actual return type of createMessageRecord
    dbMessageId = createResult.data[0]?.id; 
    if (!dbMessageId) {
        console.error(`[${correlationId}][${functionName}] Insert succeeded but no ID returned.`);
         await logProcessingEvent(
          "db_insert_text_no_id", null, correlationId,
          { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
          'Insert reported success but returned no record ID'
        );
        // Treat as failure if ID is missing
        return createCorsResponse(
            { success: false, error: 'DB insert succeeded but failed to return ID', correlationId },
            { status: 200 } // Still 200 as per original pattern
        );
    }

    console.log(`[${correlationId}][${functionName}] Successfully inserted text message, DB ID: ${dbMessageId}`);
    await logProcessingEvent(
      "text_message_received", dbMessageId, correlationId,
      { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
      null // No specific message needed for success
    );

    // TODO: Trigger downstream processing if needed (e.g., NLP analysis)
    
    // Final success response
    return createCorsResponse(
      { success: true, operation: 'created', messageId: dbMessageId, correlationId },
      { status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}][${functionName}] Exception processing text message:`, errorMessage);
    await logProcessingEvent(
        "text_handler_exception", dbMessageId, correlationId, // Use dbMessageId if available
        { function: functionName, telegram_message_id: message?.message_id, chat_id: message?.chat?.id },
        errorMessage
    );
    // Consistent error response (though original had 200, 500 seems more appropriate for exceptions)
    return createCorsResponse(
      { success: false, error: errorMessage, correlationId },
      { status: 500 }
    );
  }
}
