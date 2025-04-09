/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts";
import { supabaseClient } from "../../_shared/supabase.ts"; 
// Local Imports
import { MessageContext, TelegramMessage, MessageRecord } from '../types.ts';
import {
  findMessageByTelegramId,
  updateMessageRecord,
  logProcessingEvent,
  DbOperationResult,
  triggerCaptionParsing
} from '../utils/dbOperations.ts';
import { logWithCorrelation } from '../utils/logger.ts';

/**
 * Handles edited messages (both text and media captions) from Telegram.
 * Finds the original message record and updates the relevant content (text or caption)
 * and its edit history.
 */
export async function handleEditedMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context;
  const functionName = 'handleEditedMessage';
  let dbMessageId: string | undefined = undefined;

  logWithCorrelation(correlationId, `Processing edited message ${message.message_id}`, 'INFO', functionName);

  try {
    // Basic Validation
    if (!message || !message.chat || !message.message_id || !message.edit_date) {
      throw new Error(`Invalid edited message structure: Missing chat, message_id, or edit_date`);
    }

    // Determine Edit Type (Text vs. Media)
    const isTextEdit = !!message.text;
    const isMediaEdit = !!(message.photo || message.video || message.document);

    if (!isTextEdit && !isMediaEdit) {
        // Neither text nor known media - likely unsupported edit type (e.g., poll)
        logWithCorrelation(correlationId, `Received edit for unsupported message type (no text/photo/video/document). Skipping.`, 'WARN', functionName);
        await logProcessingEvent(
            supabaseClient,
            "edit_skipped_unsupported_type",
            null,
            correlationId,
            { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
            "Edit target message has no text or recognized media."
        );
        return createCorsResponse(
            { success: true, operation: 'skipped', reason: 'Unsupported message type for edit', correlationId },
            { status: 200 }
        );
    }

    // --- Find the Original Message --- (Use new utility function)
    logWithCorrelation(correlationId, `Looking up original message by tg_msg_id: ${message.message_id}, chat_id: ${message.chat.id}`, 'INFO', functionName);
    const findResult = await findMessageByTelegramId(
      supabaseClient, // Pass client explicitly
      message.message_id,
      message.chat.id,
      correlationId
    );

    // --- Handle Find Errors or Not Found ---    
    if (!findResult.success) {
      logWithCorrelation(correlationId, `Error finding message to edit: ${findResult.error}`, 'ERROR', functionName);
      await logProcessingEvent(
        supabaseClient,
        "db_find_edit_target_failed", 
        null, 
        correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        findResult.error ?? 'Unknown DB error'
      );
      return createCorsResponse(
        { success: false, error: `DB error finding message to edit: ${findResult.error}`, correlationId },
        { status: 200 } // Respond with 200 as per original logic
      );
    }

    if (!findResult.data) {
      logWithCorrelation(correlationId, `Original message not found for edit (tg_msg_id: ${message.message_id}, chat_id: ${message.chat.id}). Cannot process edit.`, 'WARN', functionName);
      await logProcessingEvent(
        supabaseClient,
        "edit_target_not_found", 
        null, 
        correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        "Original message not found for edit"
      );
      return createCorsResponse(
        { success: true, operation: 'skipped', reason: 'Original message not found', correlationId },
        { status: 200 } // Respond with 200 as per original logic
      );
    }

    const existingRecord = findResult.data as MessageRecord; // Cast to expected type
    dbMessageId = existingRecord.id; // Store for later use

    logWithCorrelation(correlationId, `Found existing message with DB ID: ${dbMessageId}`, 'INFO', functionName);

    // --- Check for Caption Changes (Media Messages) ---
    const hasCaptionChanged = isMediaEdit && 
                             (existingRecord.caption !== message.caption) && 
                             (message.caption !== undefined); // Only consider if caption is actually present

    if (hasCaptionChanged) {
      logWithCorrelation(correlationId, `Caption changed for media message. Old: "${existingRecord.caption}", New: "${message.caption}"`, 'INFO', functionName);
    }

    // --- Update the Message Record ---
    // For media edits, we currently only support caption changes
    // For text edits, we update the text content
    const updateResult = await updateMessageRecord(
      supabaseClient,
      existingRecord,
      message,
      null, // No media result since we're not re-processing media
      null, // No caption data - will be processed by caption parser if needed
      correlationId
    );

    if (!updateResult) {
      logWithCorrelation(correlationId, `Failed to update message record for edit`, 'ERROR', functionName);
      await logProcessingEvent(
        supabaseClient,
        "edit_db_update_failed", 
        dbMessageId, 
        correlationId,
        { function: functionName },
        "Failed to update message record for edit"
      );
      return createCorsResponse(
        { success: false, error: "Failed to update message record", correlationId },
        { status: 200 } // Respond with 200 as per original logic
      );
    }

    // --- Process Caption Changes (if applicable) ---
    if (hasCaptionChanged) {
      logWithCorrelation(correlationId, `Triggering caption parser for edited message ${dbMessageId}`, 'INFO', functionName);
      
      // Use the new triggerCaptionParsing function
      const parserResult = await triggerCaptionParsing({
        supabaseClient,
        messageId: dbMessageId,
        correlationId
      });
      
      if (!parserResult.success) {
        logWithCorrelation(correlationId, `Failed to trigger caption parser: ${parserResult.error}`, 'ERROR', functionName);
        await logProcessingEvent(
          supabaseClient,
          'caption_parser_invoke_failed',
          dbMessageId,
          correlationId,
          { error: parserResult.error, function: functionName },
          `Failed to trigger caption parser: ${parserResult.error}`
        );
      } else {
        logWithCorrelation(correlationId, `Successfully triggered caption parser for edited message ${dbMessageId}`, 'INFO', functionName);
        await logProcessingEvent(
          supabaseClient,
          'caption_parser_invoked',
          dbMessageId,
          correlationId,
          { function: functionName }
        );
      }
    } else {
       await logProcessingEvent(
            supabaseClient,
            "edit_processed_no_caption_change", 
            dbMessageId ?? null, 
            correlationId, // Handle potential undefined dbMessageId if update failed
            { function: functionName, edit_type: isTextEdit ? 'text' : 'media_no_caption_change' },
            `Message edit processed successfully.`
        );
    }

    // Final success response
    return createCorsResponse({ success: true, operation: 'updated', messageId: dbMessageId, correlationId });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception processing edited message: ${errorMessage}`, 'ERROR', functionName);
    await logProcessingEvent(
        supabaseClient,
        "edit_handler_exception", 
        dbMessageId, 
        correlationId, // Use dbMessageId if available
        { function: functionName, telegram_message_id: message?.message_id, chat_id: message?.chat?.id },
        errorMessage
    );
    return createCorsResponse(
      { success: false, error: errorMessage, correlationId },
      { status: 500 }
    );
  }
}
