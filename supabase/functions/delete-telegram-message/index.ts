import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Import singleton client
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts"; // Import standard logging

// Define expected request body structure (optional but good practice)
interface DeleteRequestBody {
  message_id: number;
  chat_id: number;
  media_group_id?: string;
}

// Core logic for deleting a Telegram message
async function handleDeleteTelegramMessage(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing delete-telegram-message request`);

  // --- Environment Variable Check ---
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!TELEGRAM_BOT_TOKEN) {
    console.error(`[${correlationId}] TELEGRAM_BOT_TOKEN is not configured`);
    // Throwing here will be caught by createHandler and logged
    throw new Error("Configuration error: TELEGRAM_BOT_TOKEN is not set");
  }

  // --- Request Body Parsing and Validation ---
  let requestBody: DeleteRequestBody;
  try {
    requestBody = await req.json();
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`); // Let createHandler format this
  }

  const { message_id, chat_id, media_group_id } = requestBody;

  if (!message_id || !chat_id) {
    console.error(`[${correlationId}] Missing required fields message_id or chat_id`);
    throw new Error("Invalid request: message_id and chat_id are required.");
  }

  console.log(`[${correlationId}] Deleting message:`, { message_id, chat_id, media_group_id });

  // --- Database Interaction: Find Message ID ---
  let messageId: string; // Database UUID
  try {
    const { data: messageData, error: messageError } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('telegram_message_id', message_id)
      .eq('chat_id', chat_id)
      .single();

    if (messageError || !messageData) {
      const dbErrorMsg = messageError?.message || "Message not found in database";
      console.error(`[${correlationId}] Error finding message in DB: ${dbErrorMsg}`);
      await logProcessingEvent(
        'message_deletion_failed',
        message_id.toString(), // entityId (use telegram_message_id if DB id unknown)
        correlationId,
        { entityType: 'message', telegram_message_id: message_id, chat_id, media_group_id, stage: 'find_message_db' }, // metadata
        dbErrorMsg // errorMessage
      );
      // Throw error to be handled by createHandler
      throw new Error(`Database error: ${dbErrorMsg}`);
    }
    messageId = messageData.id;
  } catch (dbError: unknown) {
    // Catch potential errors from the DB call itself (network etc.)
     const errorMessage = dbError instanceof Error ? dbError.message : "Database lookup failed";
     console.error(`[${correlationId}] Exception during DB lookup: ${errorMessage}`);
     await logProcessingEvent(
        'message_deletion_failed',
        message_id.toString(),
        correlationId,
        { entityType: 'message', telegram_message_id: message_id, chat_id, media_group_id, stage: 'find_message_db_exception' }, // metadata
        errorMessage // errorMessage
      );
     throw new Error(`Database error: ${errorMessage}`);
  }


  await logProcessingEvent(
    'message_deletion_started',
    messageId,
    correlationId,
    { entityType: 'message', telegram_message_id: message_id, chat_id, media_group_id } // metadata
    // No error message here
  );

  // --- Telegram API Call: Delete Main Message ---
  const deleteUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
  let telegramResult: any;
  try {
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat_id, message_id: message_id }),
    });
    telegramResult = await response.json();
    console.log(`[${correlationId}] Telegram deletion result for main message:`, telegramResult);

    if (!telegramResult.ok) {
      const errorMsg = `Failed to delete Telegram message ${message_id}: ${telegramResult.description || 'Unknown Telegram error'}`;
      console.error(`[${correlationId}] ${errorMsg}`);
      await logProcessingEvent(
        'message_deletion_failed',
        messageId,
        correlationId,
        { entityType: 'message', telegram_message_id: message_id, chat_id, media_group_id, telegram_result: telegramResult, stage: 'telegram_api_call' }, // metadata
        errorMsg // errorMessage
      );
      // Throw error - Telegram deletion failed
      throw new Error(errorMsg);
    }
  } catch (fetchError: unknown) {
     const errorMessage = fetchError instanceof Error ? fetchError.message : "Telegram API request failed";
     console.error(`[${correlationId}] Exception during Telegram API call: ${errorMessage}`);
     await logProcessingEvent(
        'message_deletion_failed',
        messageId,
        correlationId,
        { entityType: 'message', telegram_message_id: message_id, chat_id, media_group_id, stage: 'telegram_api_exception' }, // metadata
        errorMessage // errorMessage
      );
     throw new Error(`Telegram API error: ${errorMessage}`);
  }


  await logProcessingEvent(
    'message_deletion_successful',
    messageId,
    correlationId,
    { entityType: 'message', telegram_message_id: message_id, chat_id, media_group_id, telegram_result: telegramResult } // metadata
    // No error message here
  );

  // --- Media Group Deletion Logic ---
  if (media_group_id) {
    console.log(`[${correlationId}] Handling media group deletion for group: ${media_group_id}`);
    await logProcessingEvent(
      'media_group_deletion_started',
      media_group_id, // entityId
      correlationId,
      { entityType: 'media_group', parent_telegram_message_id: message_id, parent_chat_id: chat_id } // metadata
      // No error message here
    );

    let relatedMessages: { id: string; telegram_message_id: number; chat_id: number }[] = [];
    try {
      const { data, error: fetchError } = await supabaseClient
        .from('messages')
        .select('id, telegram_message_id, chat_id')
        .eq('media_group_id', media_group_id)
        .neq('telegram_message_id', message_id); // Skip the one already deleted

      if (fetchError) {
        console.error(`[${correlationId}] Error fetching related media group messages: ${fetchError.message}`);
        // Log this error but don't necessarily stop the whole process
         await logProcessingEvent(
            'media_group_deletion_failed',
            media_group_id,
            correlationId,
            { entityType: 'media_group', stage: 'fetch_related_db', parent_telegram_message_id: message_id }, // metadata
            fetchError.message // errorMessage
          );
         // Decide if this is critical - for now, we log and continue (maybe no other messages exist)
      }
      relatedMessages = data || [];
      console.log(`[${correlationId}] Found ${relatedMessages.length} related messages in group ${media_group_id}`);

    } catch (fetchDbError: unknown) {
       const errorMessage = fetchDbError instanceof Error ? fetchDbError.message : "DB error fetching related messages";
       console.error(`[${correlationId}] Exception fetching related media group messages: ${errorMessage}`);
       await logProcessingEvent(
            'media_group_deletion_failed',
            media_group_id,
            correlationId,
            { entityType: 'media_group', stage: 'fetch_related_db_exception', parent_telegram_message_id: message_id }, // metadata
            errorMessage // errorMessage
          );
       // Continue, maybe log overall failure later
    }


    const groupResults = [];
    for (const msg of relatedMessages) {
      try {
        console.log(`[${correlationId}] Deleting related message ${msg.telegram_message_id} from group ${media_group_id}`);
        const groupResponse = await fetch(deleteUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: msg.chat_id, message_id: msg.telegram_message_id }),
        });
        const groupResult = await groupResponse.json();
        groupResults.push({ telegram_message_id: msg.telegram_message_id, result: groupResult });

        if (groupResult.ok) {
           console.log(`[${correlationId}] Successfully deleted related message ${msg.telegram_message_id}`);
           // Optionally mark as deleted in DB (consider if needed, might be handled by triggers/cleanup)
           // await supabaseClient.from('messages').update({ deleted_from_telegram: true }).eq('id', msg.id);
           await logProcessingEvent(
              'message_deletion_successful', // Log individual message deletion
              msg.id,
              correlationId,
              { entityType: 'message', telegram_message_id: msg.telegram_message_id, chat_id: msg.chat_id, media_group_id, reason: 'part_of_group_deletion' } // metadata
              // No error message here
            );
        } else {
           console.warn(`[${correlationId}] Failed to delete related message ${msg.telegram_message_id}: ${groupResult.description}`);
           await logProcessingEvent(
              'message_deletion_failed', // Log individual message deletion failure
              msg.id,
              correlationId,
              { entityType: 'message', telegram_message_id: msg.telegram_message_id, chat_id: msg.chat_id, media_group_id, telegram_result: groupResult, stage: 'telegram_api_group' }, // metadata
              groupResult.description || 'Telegram group deletion failed' // errorMessage
            );
           // Continue deleting others
        }
      } catch (groupError: unknown) {
        const errorMessage = groupError instanceof Error ? groupError.message : "Failed to delete group message";
        console.error(`[${correlationId}] Exception deleting group message ${msg.telegram_message_id}:`, errorMessage);
        groupResults.push({ telegram_message_id: msg.telegram_message_id, error: errorMessage });
         await logProcessingEvent(
            'message_deletion_failed',
            msg.id,
            correlationId,
            { entityType: 'message', telegram_message_id: msg.telegram_message_id, chat_id: msg.chat_id, media_group_id, stage: 'telegram_api_group_exception' }, // metadata
            errorMessage // errorMessage
          );
        // Continue deleting others
      }
    }

    await logProcessingEvent(
      'media_group_deletion_completed',
      media_group_id,
      correlationId,
      { entityType: 'media_group', parent_telegram_message_id: message_id, results: groupResults } // metadata
      // No error message here
    );
  }

  // --- Success Response ---
  return createSuccessResponse({ success: true }, correlationId);
}

// Create and configure the handler
const handler = createHandler(handleDeleteTelegramMessage)
  .withMethods(['POST']) // Should only be called via POST
  .withSecurity(SecurityLevel.AUTHENTICATED) // Requires user authentication token
  .build();

// Serve the handler
serve(handler);

console.log("delete-telegram-message function deployed and listening.");
