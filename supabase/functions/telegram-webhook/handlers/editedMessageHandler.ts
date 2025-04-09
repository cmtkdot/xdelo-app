/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts";
import { logProcessingEvent } from "../utils/dbOperations.ts"; 
import { supabaseClient } from "../../_shared/supabase.ts"; 
// Local Imports
import { MessageContext, TelegramMessage, MessageRecord } from '../types.ts';
import { constructTelegramMessageUrl } from '../utils/messageUtils.ts';
import {
  findMessageByTelegramId,
  updateMessageRecord,
  DbOperationResult
} from '../utils/dbOperations.ts';

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
        await logProcessingEvent(
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
    console.log(`[${correlationId}][${functionName}] Looking up original message by tg_msg_id: ${message.message_id}, chat_id: ${message.chat.id}`);
    const findResult = await findMessageByTelegramId(
      supabaseClient, // Pass client explicitly
      message.message_id,
      message.chat.id,
      correlationId
    );

    // --- Handle Find Errors or Not Found ---    
    if (!findResult.success) {
      console.error(`[${correlationId}][${functionName}] Error finding message to edit:`, findResult.error);
      await logProcessingEvent(
        "db_find_edit_target_failed", null, correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        findResult.error ?? 'Unknown DB error'
      );
      return createCorsResponse(
        { success: false, error: `DB error finding message to edit: ${findResult.error}`, correlationId },
        { status: 200 } // Respond with 200 as per original logic
      );
    }

    if (!findResult.data) {
      console.warn(`[${correlationId}][${functionName}] Original message not found for edit (tg_msg_id: ${message.message_id}, chat_id: ${message.chat.id}). Cannot process edit.`);
      await logProcessingEvent(
        "edit_target_not_found", null, correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        "Original message not found for edit"
      );
      return createCorsResponse(
        { success: true, operation: 'skipped', reason: 'Original message not found', correlationId },
        { status: 200 } // Respond with 200 as per original logic
      );
    }

    const existingRecord = findResult.data as MessageRecord; // Cast to expected type
    dbMessageId = existingRecord.id; // id is likely string (uuid), check MessageRecord definition
    console.log(`[${correlationId}][${functionName}] Found existing message ${dbMessageId} for edit.`);

    // --- Prepare Common Update Fields --- 
    const currentEditHistory = existingRecord.edit_history || [];
    const editCount = (existingRecord.retry_count || 0) + 1; // Assuming retry_count was meant for edits?
    const editDateIso = new Date(message.edit_date * 1000).toISOString();
    const messageUrl = constructTelegramMessageUrl(message);

    let updateData: Partial<MessageRecord> = {
      last_edited_at: editDateIso,
      // Note: Ensure MessageRecord has `edit_count` field or adjust below
      // retry_count: editCount, // Or use a dedicated `edit_count` field if available
      edit_history: [...currentEditHistory, { date: editDateIso, content: isTextEdit ? message.text : message.caption }],
    };

    let captionChanged = false;

    // --- Handle Text Edit ---    
    if (isTextEdit) {
      console.log(`[${correlationId}][${functionName}] Handling text edit for message ${dbMessageId}.`);
      updateData.text_content = message.text;
      // If text is edited, potentially clear/reset related fields if needed
      // updateData.analyzed_content = null; // Example: Reset analysis if text changes
    }

    // --- Handle Media Caption Edit ---    
    if (isMediaEdit && message.caption !== existingRecord.caption) {
      console.log(`[${correlationId}][${functionName}] Handling caption edit for message ${dbMessageId}.`);
      captionChanged = true;
      updateData.caption = message.caption;
      // Keep existing media info (storage_path, public_url etc.) as it's just a caption edit
    }

    // --- Update the Message Record --- (Use new utility function)
    console.log(`[${correlationId}][${functionName}] Updating message ${dbMessageId} with edit data.`);
    const updateResult = await updateMessageRecord(
      supabaseClient,
      dbMessageId,
      updateData,
      correlationId
    );

    // --- Handle Update Errors ---    
    if (!updateResult.success) {
      console.error(`[${correlationId}][${functionName}] Error updating message ${dbMessageId}:`, updateResult.error);
      await logProcessingEvent(
        "db_update_edit_failed", dbMessageId, correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        updateResult.error ?? 'Unknown DB error'
      );
      // Log error but respond successfully as per original logic
      return createCorsResponse(
          { success: false, error: `Failed to save edit: ${updateResult.error}`, correlationId },
          { status: 200 }
      );
    }

    console.log(`[${correlationId}][${functionName}] Successfully updated message ${dbMessageId}.`);

    // --- Trigger Caption Processing if Caption Changed ---    
    if (captionChanged && dbMessageId) { // Ensure we have the dbMessageId
      console.log(`[${correlationId}][${functionName}] Caption changed for ${dbMessageId}, invoking parser function.`);
      // Fire-and-forget call to the caption parser function
      (async () => {
        try {
          const parserUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/manual-caption-parser`;
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

          if (!parserUrl || !serviceKey) {
            console.error(`[${correlationId}][${functionName}] CRITICAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for caption parser call.`);
            await logProcessingEvent(
              supabaseClient,
              'caption_parser_invoke_error',
              dbMessageId,
              correlationId,
              { error: 'Missing env vars for parser', function: functionName },
              'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
            );
            return; // Cannot proceed
          }

          const parserPayload = {
            messageId: dbMessageId, // Pass the DB UUID
            // Pass other relevant details if needed by the parser
            correlationId: correlationId, 
          };

          const response = await fetch(parserUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
              'x-client-info': 'supabase-edge-function-editedMessageHandler'
            },
            body: JSON.stringify(parserPayload)
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[${correlationId}][${functionName}] Error invoking caption parser for edited message ${dbMessageId}. Status: ${response.status}, Body: ${errorBody}`);
            // Log this error - don't fail the edit operation
            await logProcessingEvent(
              supabaseClient,
              'caption_parser_invoke_failed',
              dbMessageId,
              correlationId,
              { status: response.status, errorBody: errorBody, function: functionName },
              `Caption parser invocation failed with status ${response.status}`
            );
          } else {
            console.log(`[${correlationId}][${functionName}] Successfully invoked caption parser for edited message ${dbMessageId}.`);
             // Log success (optional)
            await logProcessingEvent(
              supabaseClient,
              'caption_parser_invoked',
              dbMessageId,
              correlationId,
              { function: functionName }
            );
          }
        } catch (fetchError: any) {
          console.error(`[${correlationId}][${functionName}] Network/fetch error invoking caption parser for edited message ${dbMessageId}:`, fetchError);
           await logProcessingEvent(
              supabaseClient,
              'caption_parser_invoke_exception',
              dbMessageId,
              correlationId,
              { errorMessage: fetchError.message, stack: fetchError.stack, function: functionName },
              `Fetch exception invoking caption parser: ${fetchError.message}`
            );
        }
      })(); // End of immediately invoked async function
    } else {
       await logProcessingEvent(
            "edit_processed_no_caption_change", dbMessageId ?? null, correlationId, // Handle potential undefined dbMessageId if update failed
            { function: functionName, edit_type: isTextEdit ? 'text' : 'media_no_caption_change' },
            `Message edit processed successfully.`
        );
    }

    // Final success response
    return createCorsResponse({ success: true, operation: 'updated', messageId: dbMessageId, correlationId });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}][${functionName}] Exception processing edited message:`, errorMessage);
    await logProcessingEvent(
        "edit_handler_exception", dbMessageId, correlationId, // Use dbMessageId if available
        { function: functionName, telegram_message_id: message?.message_id, chat_id: message?.chat?.id },
        errorMessage
    );
    return createCorsResponse(
      { success: false, error: errorMessage, correlationId },
      { status: 500 }
    );
  }
}
