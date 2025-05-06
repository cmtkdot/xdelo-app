/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />
// Assuming necessary imports are already present in your file, like:
// IMPORTANT: Verify these relative paths are correct based on your functions directory structure.
import { supabaseClient } from "../../_shared/supabaseClient.ts"; // Adjust path if needed
import { logProcessingEvent, updateMessageRecord, findMessageByTelegramId } from '../utils/dbOperations.ts'; // Adjust path if needed
import { logWithCorrelation } from '../utils/logger.ts'; // Adjust path if needed
import { xdelo_parseCaption } from '../../_shared/captionParser.ts'; // Use the provided parser
import { createTelegramErrorResponse } from "../utils/errorUtils.ts"; // Adjust path if needed
// --- End Type Definitions ---
/**
 * Handles edited messages from Telegram.
 * If the original message is found, updates it with new caption/text,
 * archives old analysis, resets processing state, and relies on DB triggers for sync.
 * If not found, returns metadata for fallback processing.
 */ export async function handleEditedMessage(message, context) {
  const { correlationId, waitUntil } = context; // Destructure waitUntil
  const functionName = 'handleEditedMessage';
  logWithCorrelation(correlationId, `Processing edited message ${message?.message_id}`, 'INFO', functionName);
  try {
    // Basic Validation
    if (!message || !message.message_id || !message.chat?.id) {
      const errorMessage = `Invalid edited message structure: Missing message_id or chat.id`;
      logWithCorrelation(correlationId, errorMessage, 'ERROR', functionName, {
        message
      });
      return createTelegramErrorResponse(errorMessage, functionName, 400, correlationId, {
        messageId: message?.message_id
      });
    }
    const messageId = message.message_id;
    const chatId = message.chat.id;
    // 1. Check if the original message exists
    logWithCorrelation(correlationId, `Looking up original message by tg_msg_id: ${messageId}, chat_id: ${chatId}`, 'DEBUG', functionName);
    const { success: messageFound, message: existingMessage } = await findMessageByTelegramId(supabaseClient, messageId, chatId, correlationId); // Type assertion using inline interface
    // Determine message type for potential fallback routing
    const detailedType = message.photo ? "photo" : message.video ? "video" : message.document ? "document" : message.text ? "text" : "other";
    const messageType = detailedType === "photo" || detailedType === "video" || detailedType === "document" ? "media" : detailedType;
    // 2. Handle Message Not Found (Fallback)
    if (!messageFound || !existingMessage) {
      logWithCorrelation(correlationId, `Original message ${messageId} not found, returning for fallback processing as ${detailedType}`, 'INFO', functionName);
      await logProcessingEvent(supabaseClient, "edited_message_not_found", null, correlationId, {
        function: functionName,
        telegram_message_id: messageId,
        chat_id: chatId,
        message_type: messageType
      }, "Original message not found, will fallback to processing as new message");
      return {
        messageNotFound: true,
        messageType,
        detailedType,
        media: messageType === 'media',
        isRecoveredEdit: true
      };
    }
    // 3. Original Message Found - Process Edit
    logWithCorrelation(correlationId, `Found original message ${existingMessage.id}, processing edit`, 'INFO', functionName);
    const newCaption = message.caption || null;
    const newText = message.text || null;
    // Check if relevant content changed
    const captionChanged = newCaption !== existingMessage.caption;
    const textChanged = newText !== existingMessage.text;
    const contentChanged = captionChanged || textChanged;
    // --- If no relevant content change, just update metadata ---
    if (!contentChanged) {
      logWithCorrelation(correlationId, `No caption or text change detected for message ${existingMessage.id}, updating metadata only.`, 'INFO', functionName);
      const noChangeUpdates = {
        last_edited_at: new Date(message.edit_date * 1000).toISOString(),
        edit_count: (existingMessage.edit_count || 0) + 1,
        message_data: message,
        is_edit: true,
        edit_timestamp: new Date(message.edit_date * 1000).toISOString()
      };
      // Call updateMessageRecord just to update metadata
      await updateMessageRecord(supabaseClient, existingMessage, message, null, null, correlationId, noChangeUpdates);
      return new Response(JSON.stringify({
        success: true,
        operation: 'skipped_no_change',
        messageId: existingMessage.id,
        correlationId
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    logWithCorrelation(correlationId, `Content changed for message ${existingMessage.id}. Caption changed: ${captionChanged}, Text changed: ${textChanged}`, 'INFO', functionName);
    // 4. Prepare Updates Object
    const updates = {
      message_data: message,
      last_edited_at: new Date(message.edit_date * 1000).toISOString(),
      edit_count: (existingMessage.edit_count || 0) + 1,
      is_edit: true,
      edit_timestamp: new Date(message.edit_date * 1000).toISOString(),
      // Add edit history entry - ensure your updateMessageRecord handles this or adjust here
      edit_history: [
        {
          edited_at: new Date(message.edit_date * 1000).toISOString(),
          previous_caption: existingMessage.caption,
          // previous_caption_data: existingMessage.caption_data, // Only if caption_data exists and is needed
          correlation_id: correlationId
        },
        ...existingMessage.edit_history || []
      ]
    };
    let analyzedContentData = null;
    // 5. Handle Caption Change Specifics
    if (captionChanged) {
      updates.caption = newCaption; // Update the caption column
      if (newCaption) {
        // Parse the new caption using xdelo_parseCaption
        analyzedContentData = xdelo_parseCaption(newCaption, {});
        logWithCorrelation(correlationId, `Reparsed caption for message ${existingMessage.id}`, 'DEBUG', functionName);
      } else {
        analyzedContentData = null;
        logWithCorrelation(correlationId, `Caption removed for message ${existingMessage.id}`, 'INFO', functionName);
      }
      // Archive old content and set new content
      updates.old_analyzed_content = existingMessage.analyzed_content || null;
      updates.analyzed_content = analyzedContentData;
      updates.caption_data = analyzedContentData; // Update caption_data as well (if column exists)
      updates.processing_state = 'initialized'; // Reset state for DB triggers
    } else if (textChanged) {
      // Handle text change
      updates.text = newText; // Update the text column
      // Keep existing analysis if only text changed
      analyzedContentData = existingMessage.analyzed_content; // Keep old analysis
      updates.analyzed_content = existingMessage.analyzed_content; // Ensure it's part of updates if needed by updateMessageRecord
      updates.caption_data = existingMessage.caption_data; // Keep old caption_data
      logWithCorrelation(correlationId, `Text changed for message ${existingMessage.id}, caption unchanged.`, 'INFO', functionName);
    } else {
      analyzedContentData = existingMessage.analyzed_content; // Fallback
    }
    // 6. Update Message Record in DB
    logWithCorrelation(correlationId, `Calling updateMessageRecord for message ${existingMessage.id}`, 'DEBUG', functionName);
    // Pass null for the separate captionData argument as it's now included in 'updates'
    const updateResult = await updateMessageRecord(supabaseClient, existingMessage, message, null, null, correlationId, updates // Pass the consolidated updates object
    );
    if (!updateResult || !updateResult.success) {
      const errorMsg = updateResult?.error ? updateResult.error.message || JSON.stringify(updateResult.error) : 'Update operation failed';
      logWithCorrelation(correlationId, `Failed to update message record ${existingMessage.id} during edit: ${errorMsg}`, 'ERROR', functionName);
      await logProcessingEvent(supabaseClient, "edited_message_update_failed", existingMessage.id, correlationId, {
        function: functionName,
        telegram_message_id: messageId,
        chat_id: chatId
      }, `Failed to update message record for edit: ${errorMsg}`);
      return createTelegramErrorResponse(errorMsg, functionName, 500, correlationId, {
        messageId,
        chatId
      });
    }
    // 7. Media Group Sync Handling (Relying on DB Trigger)
    // The database AFTER trigger (`x_trigger_sync_media_group`) will automatically
    // detect the changes (like processing_state becoming 'initialized' or caption changing)
    // and call the `x_sync_media_group_captions` function if needed.
    if (captionChanged && existingMessage.media_group_id) {
      logWithCorrelation(correlationId, `Caption changed for message ${existingMessage.id} in media group ${existingMessage.media_group_id}. DB AFTER trigger will handle sync.`, 'INFO', functionName);
    }
    // 8. Log Success
    logWithCorrelation(correlationId, `Successfully updated message ${existingMessage.id} from edit.`, 'INFO', functionName);
    await logProcessingEvent(supabaseClient, "message_edit_processed", existingMessage.id, correlationId, {
      function: functionName,
      telegram_message_id: messageId,
      chat_id: chatId,
      caption_changed: captionChanged,
      text_changed: textChanged
    }, null); // No error
    // 9. Return Success Response to Telegram
    return new Response(JSON.stringify({
      success: true,
      operation: 'updated',
      messageId: existingMessage.id,
      correlationId,
      content_processed: contentChanged // Indicate if caption or text changed
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    // --- Global Error Handling for handleEditedMessage ---
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(correlationId, `Exception processing edited message: ${errorMessage}`, 'ERROR', functionName, {
      stack: error instanceof Error ? error.stack : undefined
    });
    await logProcessingEvent(supabaseClient, "edited_message_handler_exception", null, correlationId, {
      function: functionName,
      telegram_message_id: message?.message_id || 0,
      chat_id: message?.chat?.id || 0
    }, errorMessage);
    // Return 500 - might trigger retries from Telegram
    return createTelegramErrorResponse(`Exception processing edited message: ${errorMessage}`, functionName, 500, correlationId, {
      messageId: message?.message_id,
      chatId: message?.chat?.id
    });
  }
} // NOTE: Ensure that the 'updateMessageRecord' function correctly handles
 // applying ALL fields from the 'updates' object passed as the last argument.
