/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts";
import { logAuditEvent } from "../../_shared/dbUtils.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
// Local Imports
import { MessageContext, TelegramMessage } from '../types.ts';
import { constructTelegramMessageUrl } from '../utils/messageUtils.ts';
// Import caption processing trigger function (assuming it remains accessible)
// TODO: Potentially move xdelo_processCaptionChanges to a shared location later
import { xdelo_processCaptionChanges } from './mediaMessageHandler.ts'; // TEMPORARY: May need adjustment

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

  console.log(`[${correlationId}][${functionName}] Processing edited message ${message.message_id}`);

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
        console.warn(`[${correlationId}][${functionName}] Received edit for unsupported message type (no text/photo/video/document). Skipping.`);
        await logAuditEvent(
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

    // --- Find the Original Message --- (Use same lookup for both types)
    console.log(`[${correlationId}][${functionName}] Looking up original message by tg_msg_id: ${message.message_id}, chat_id: ${message.chat.id}`);
    const { data: existingRecord, error: findError } = await supabaseClient
      .from('messages')
      // Select fields needed for *either* text or media edit update
      .select('id, text_content, caption, analyzed_content, edit_history, edit_count, media_group_id')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    // --- Handle Find Errors or Not Found ---    
    if (findError) {
      console.error(`[${correlationId}][${functionName}] Error finding message to edit:`, findError);
      await logAuditEvent(
        "db_find_edit_target_failed", null, correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        findError.message
      );
      return createCorsResponse(
        { success: false, error: `DB error finding message to edit: ${findError.message}`, correlationId },
        { status: 200 }
      );
    }

    if (!existingRecord) {
      console.warn(`[${correlationId}][${functionName}] Original message not found for edit (tg_msg_id: ${message.message_id}, chat_id: ${message.chat.id}). Cannot process edit.`);
      await logAuditEvent(
        "edit_target_not_found", null, correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        "Original message not found for edit"
      );
      return createCorsResponse(
        { success: true, operation: 'skipped', reason: 'Original message not found', correlationId },
        { status: 200 }
      );
    }

    dbMessageId = existingRecord.id;
    console.log(`[${correlationId}][${functionName}] Found existing message ${dbMessageId} for edit.`);

    // --- Prepare Common Update Fields --- 
    const currentEditHistory = existingRecord.edit_history || [];
    const editCount = (existingRecord.edit_count || 0) + 1;
    const editDateIso = new Date(message.edit_date * 1000).toISOString();
    const messageUrl = constructTelegramMessageUrl(message);

    let updateData: Record<string, any> = {
        telegram_data: message, // Always update the raw data
        edit_count: editCount,
        edit_date: editDateIso,
        message_url: messageUrl, 
        updated_at: new Date().toISOString(),
        correlation_id: correlationId,
        error_message: null, // Clear any previous errors
        last_error_at: null,
    };
    let previousStateEntry: Record<string, any> = { 
        timestamp: new Date().toISOString(),
        edit_date: editDateIso,
    };
    let operationType: 'text_edit' | 'caption_edit' | 'skipped_no_change' = 'skipped_no_change';
    let contentChanged = false;
    let triggerCaptionProcessing = false;

    // --- Handle Text Edit Path --- 
    if (isTextEdit) {
        console.log(`[${correlationId}][${functionName}] Processing as TEXT edit.`);
        operationType = 'text_edit';
        if (existingRecord.text_content !== message.text) {
            console.log(`[${correlationId}][${functionName}] Text content changed.`);
            contentChanged = true;
            previousStateEntry.previous_text_content = existingRecord.text_content;
            updateData.text_content = message.text;
            updateData.processing_state = 'processed'; // Text edits are usually final
        } else {
            console.log(`[${correlationId}][${functionName}] Text content unchanged.`);
        }
    }
    // --- Handle Media (Caption) Edit Path --- 
    else if (isMediaEdit) {
        console.log(`[${correlationId}][${functionName}] Processing as MEDIA edit (caption focus).`);
        operationType = 'caption_edit';
        const newCaption = message.caption || null; // Ensure null if empty/undefined
        if (existingRecord.caption !== newCaption) {
            console.log(`[${correlationId}][${functionName}] Caption content changed.`);
            contentChanged = true;
            previousStateEntry.previous_caption = existingRecord.caption;
            previousStateEntry.previous_analyzed_content = existingRecord.analyzed_content;
            updateData.caption = newCaption;
            // If caption changed, it likely needs reprocessing
            updateData.processing_state = 'pending_caption_update'; 
            triggerCaptionProcessing = true;
        } else {
            console.log(`[${correlationId}][${functionName}] Caption content unchanged.`);
        }
    }

    // --- Perform Update only if Content Changed --- 
    if (!contentChanged) {
        console.log(`[${correlationId}][${functionName}] No relevant content change detected. Skipping DB update.`);
        await logAuditEvent(
            `${operationType}_skipped_no_change`, // e.g., text_edit_skipped_no_change
            dbMessageId,
            correlationId,
            { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
            "Content identical to existing record."
        );
        return createCorsResponse(
            { success: true, messageId: dbMessageId, operation: 'skipped_no_change', correlationId },
            { status: 200 }
        );
    }

    // Add the history entry and finalize update payload
    updateData.edit_history = [...currentEditHistory, previousStateEntry];

    console.log(`[${correlationId}][${functionName}] Updating message ${dbMessageId} for ${operationType}.`);
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update(updateData)
      .eq('id', dbMessageId);

    if (updateError) {
      console.error(`[${correlationId}][${functionName}] Error updating edited message ${dbMessageId}:`, updateError);
      await logAuditEvent(
        "message_update_failed", dbMessageId, correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id, update_type: operationType, table: 'messages' },
        updateError.message
      );
      throw new Error(`Failed to update edited message: ${updateError.message}`);
    }

    console.log(`[${correlationId}][${functionName}] Successfully updated message ID: ${dbMessageId}`);
    await logAuditEvent(
      operationType === 'text_edit' ? "text_message_edited" : "media_message_caption_edited",
      dbMessageId,
      correlationId,
      { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id, edit_count: editCount },
      null
    );

    // --- Trigger Caption Processing If Needed ---
    if (triggerCaptionProcessing) {
        console.log(`[${correlationId}][${functionName}] Caption changed. Triggering re-parsing for message ${dbMessageId}`);
        // Pass necessary info to the caption processing function
        await xdelo_processCaptionChanges(
            // supabaseClient, // Pass client if still needed by the function signature
            dbMessageId,
            updateData.caption, // Pass the new caption
            existingRecord.media_group_id, // Pass media group ID if relevant
            correlationId,
            true // Indicate this is an edit
        );
        // Audit log for trigger is handled inside xdelo_processCaptionChanges
    }

    // --- Return Success Response ---
    return createCorsResponse(
      { success: true, messageId: dbMessageId, operation: 'updated', update_type: operationType, correlationId },
      { status: 200 }
    );

  } catch (error) {
    // --- Centralized Error Handling ---
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}][${functionName}] Unhandled error:`, errorMessage);
    await logAuditEvent(
      "message_processing_failed", dbMessageId || null, correlationId,
      { handler_type: functionName, telegram_message_id: message?.message_id, chat_id: message?.chat?.id },
      errorMessage
    );
    return createCorsResponse(
      { success: false, error: `Failed in ${functionName}: ${errorMessage}`, correlationId },
      { status: 200 }
    );
  }
}

// Note: The dependency on xdelo_processCaptionChanges from mediaMessageHandler.ts
// needs to be resolved. Ideally, move xdelo_processCaptionChanges to a shared utility file.
