/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

// Shared Imports
import { createCorsResponse } from "../../_shared/cors.ts";
import { logAuditEvent } from "../../_shared/dbUtils.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
// Local Imports
import { MessageContext, TelegramMessage } from '../types.ts';
import { constructTelegramMessageUrl } from '../utils/messageUtils.ts';

/**
 * Handles new non-media (text) messages from Telegram.
 * Assumes edited messages are routed to handleEditedMessage.
 * Inserts a new record into the 'messages' table.
 */
export async function handleOtherMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId } = context; // isEdit is ignored here
  const functionName = 'handleOtherMessage';
  let dbMessageId: string | undefined = undefined;

  console.log(`[${correlationId}][${functionName}] Processing new text/other message ${message.message_id}`);

  try {
    // Basic Validation
    if (!message || !message.chat || !message.message_id || !message.text) {
      // Added check for message.text as this handler is for text messages
      throw new Error(`Invalid text message structure: Missing chat, message_id, or text content`);
    }

    // --- Check if message ALREADY exists (e.g., race condition, retry) ---
    // Avoid inserting duplicates if possible.
    const { data: existingRecord, error: findErr } = await supabaseClient
      .from('messages')
      .select('id') // Only need ID to check existence
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle();

    if (findErr) {
      console.error(`[${correlationId}][${functionName}] Error checking existing message:`, findErr);
      // Log failure but maybe still attempt insert? Or throw? Let's throw for now.
      await logAuditEvent(
        "db_find_existing_failed",
        null,
        correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        findErr.message
      );
      throw new Error(`DB error checking for existing text message: ${findErr.message}`);
    }

    if (existingRecord) {
      // Message already exists, likely due to retry or race condition. Log and skip.
      dbMessageId = existingRecord.id;
      console.warn(`[${correlationId}][${functionName}] Message ${message.message_id} already exists in DB (ID: ${dbMessageId}). Skipping insert.`);
      await logAuditEvent(
        "text_message_skipped_duplicate",
        dbMessageId,
        correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
        "Message already processed."
      );
      // Return success as the message *is* effectively processed.
      return createCorsResponse(
        { success: true, messageId: dbMessageId, operation: 'skipped_duplicate', correlationId },
        { status: 200 }
      );
    }

    // --- INSERT New Text Message ---
    console.log(`[${correlationId}][${functionName}] No existing record found. Inserting new text message.`);
    const messageUrl = constructTelegramMessageUrl(message);

    // Prepare Insert Data (only necessary fields for text)
    const insertData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      user_id: message.from?.id?.toString(),
      text_content: message.text, // Store text content
      message_type: 'text', // Explicitly set message_type
      telegram_data: message, // Store raw message
      message_url: messageUrl,
      processing_state: 'processed', // Mark as processed as there's no media/caption step
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      correlation_id: correlationId,
      // Ensure nullable fields potentially used by media messages are null
      caption: null,
      media_group_id: null,
      file_id: null,
      file_unique_id: null,
      mime_type: null,
      mime_type_original: null,
      mime_type_verified: null,
      file_size: null,
      width: null,
      height: null,
      duration: null,
      storage_path: null,
      public_url: null,
      content_disposition: null,
      storage_exists: false,
      storage_path_standardized: false,
      needs_redownload: false,
      processing_state_details: null,
      analyzed_content: null,
      old_analyzed_content: null,
      error_message: null,
      retry_count: 0,
      last_error_at: null,
      edit_history: null, // No history on initial insert
      edit_count: 0,
      is_edited_channel_post: false, // Not edited on insert
      edit_date: null,
      forward_info: null, // Simplified: Forward info handled elsewhere if needed
      message_caption_id: null,
      is_original_caption: false,
      group_caption_synced: false,
    };

    // Perform Insert
    const { data: inserted, error: insertError } = await supabaseClient
      .from('messages')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error(`[${correlationId}][${functionName}] Error inserting text message:`, insertError);
      await logAuditEvent(
        "message_insert_failed",
        null,
        correlationId,
        { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id, table: 'messages' },
        insertError?.message || "Insert failed or no ID returned"
      );
      throw new Error(`DB error inserting text message: ${insertError?.message || 'No ID returned'}`);
    }
    dbMessageId = inserted.id;
    console.log(`[${correlationId}][${functionName}] Successfully inserted text message ID: ${dbMessageId}`);

    // Log Success Audit
    await logAuditEvent(
      "text_message_created",
      dbMessageId,
      correlationId,
      { function: functionName, telegram_message_id: message.message_id, chat_id: message.chat.id },
      null
    );

    // --- Return Success Response ---
    return createCorsResponse(
      { success: true, messageId: dbMessageId, operation: 'inserted', correlationId },
      { status: 200 }
    );

  } catch (error) {
    // --- Centralized Error Handling ---
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}][${functionName}] Unhandled error:`, errorMessage);
    await logAuditEvent(
      "message_processing_failed",
      dbMessageId || null,
      correlationId,
      { handler_type: functionName, telegram_message_id: message?.message_id, chat_id: message?.chat?.id },
      errorMessage
    );
    // Return 200 OK to Telegram even on failure
    return createCorsResponse(
      { success: false, error: `Failed in ${functionName}: ${errorMessage}`, correlationId },
      { status: 200 }
    );
  }
}
