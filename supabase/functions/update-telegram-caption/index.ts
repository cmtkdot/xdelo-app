import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

interface UpdateCaptionBody {
  messageId: string; // Database message ID (UUID)
  newCaption: string;
}

// Core logic for updating Telegram caption
async function handleUpdateCaption(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing update-telegram-caption request`);

  // --- Environment Variable Check ---
  const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!TELEGRAM_BOT_TOKEN) {
    console.error(`[${correlationId}] TELEGRAM_BOT_TOKEN is not configured`);
    await logProcessingEvent('caption_update_failed', 'system', correlationId, {}, 'Missing Telegram Bot Token');
    throw new Error("Configuration error: TELEGRAM_BOT_TOKEN is not set");
  }

  // --- Request Body Parsing and Validation ---
  let requestBody: UpdateCaptionBody;
  try {
    requestBody = await req.json();
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const { messageId, newCaption } = requestBody;
  if (!messageId || newCaption === undefined || newCaption === null) { // Allow empty string caption
    console.error(`[${correlationId}] Missing required fields messageId or newCaption`);
    throw new Error("Invalid request: messageId and newCaption are required.");
  }

  await logProcessingEvent('caption_update_started', messageId, correlationId, { newCaptionLength: newCaption.length });
  console.log(`[${correlationId}] Updating caption for DB message ${messageId}. New caption length: ${newCaption.length}`);

  try {
    // --- Fetch Message Details ---
    const { data: message, error: messageError } = await supabaseClient
      .from("messages")
      .select("id, caption, chat_id, telegram_message_id, media_group_id, telegram_data, storage_path, public_url") // Select all needed fields
      .eq("id", messageId)
      .single();

    if (messageError) {
      console.error(`[${correlationId}] Error fetching message ${messageId}:`, messageError);
      await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'fetch_message' }, messageError.message);
      throw new Error(`Database error fetching message: ${messageError.message}`);
    }
    if (!message) {
        console.error(`[${correlationId}] Message ${messageId} not found.`);
        await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'fetch_message' }, 'Message not found');
        throw new Error(`Message not found: ${messageId}`);
    }
    if (!message.chat_id || !message.telegram_message_id) {
        console.error(`[${correlationId}] Message ${messageId} is missing chat_id or telegram_message_id.`);
        await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'fetch_message' }, 'Missing chat_id or telegram_message_id');
        throw new Error(`Data integrity error: Message ${messageId} missing key Telegram identifiers.`);
    }

    // --- Check if Caption Changed ---
    const currentCaption = message.caption || "";
    if (currentCaption === newCaption) {
      console.log(`[${correlationId}] Caption for message ${messageId} is unchanged. Skipping update.`);
      await logProcessingEvent('caption_update_skipped', messageId, correlationId, { reason: 'unchanged' });
      return createSuccessResponse({ success: true, message: "Caption unchanged" }, correlationId);
    }

    // --- Update Caption via Telegram API ---
    let telegramUpdateOk = false;
    try {
      console.log(`[${correlationId}] Calling Telegram API to update caption for message ${message.telegram_message_id}`);
      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat_id,
            message_id: message.telegram_message_id,
            caption: newCaption,
          }),
        }
      );

      const telegramResult = await telegramResponse.json();
      console.log(`[${correlationId}] Telegram API response for message ${message.telegram_message_id}:`, telegramResult);

      if (telegramResponse.ok) {
        telegramUpdateOk = true;
        await logProcessingEvent('caption_update_telegram_success', messageId, correlationId, { telegram_message_id: message.telegram_message_id });
      } else if (telegramResult.description?.includes("message is not modified")) {
        // Treat "not modified" as success for our purpose, as DB needs update anyway
        console.warn(`[${correlationId}] Telegram reported caption not modified for message ${message.telegram_message_id}, proceeding with DB update.`);
        telegramUpdateOk = true; // Allow DB update
        await logProcessingEvent('caption_update_telegram_skipped', messageId, correlationId, { telegram_message_id: message.telegram_message_id, reason: 'not modified' });
      } else {
        const errorMsg = `Telegram API error: ${telegramResult.description || JSON.stringify(telegramResult)}`;
        console.error(`[${correlationId}] ${errorMsg}`);
        await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'telegram_api', telegram_result: telegramResult }, errorMsg);
        throw new Error(errorMsg);
      }
    } catch (apiError: unknown) {
        const errorMessage = apiError instanceof Error ? apiError.message : "Telegram API request failed";
        // Avoid double logging if already logged
        if (!errorMessage.startsWith('Telegram API error')) {
            console.error(`[${correlationId}] Exception calling Telegram API: ${errorMessage}`);
            await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'telegram_api_exception' }, errorMessage);
        }
        throw new Error(`Telegram API error: ${errorMessage}`);
    }

    // --- Update Database ---
    if (telegramUpdateOk) { // Only update DB if Telegram call was OK or "not modified"
      try {
        // Update telegram_data cautiously
        const updatedTelegramData = message.telegram_data ? { ...message.telegram_data } : {};
        // Ensure nested structure exists before assigning
        if (updatedTelegramData.message) {
            updatedTelegramData.message.caption = newCaption;
        } else if (updatedTelegramData.channel_post) {
             updatedTelegramData.channel_post.caption = newCaption;
        } else {
            // If neither exists, maybe log a warning or decide structure
            console.warn(`[${correlationId}] Could not find 'message' or 'channel_post' in telegram_data for message ${messageId} to update caption.`);
        }


        console.log(`[${correlationId}] Updating database record for message ${messageId}`);
        const { error: updateError } = await supabaseClient
          .from("messages")
          .update({
            caption: newCaption,
            telegram_data: updatedTelegramData, // Store updated raw data
            updated_at: new Date().toISOString(),
            processing_state: 'pending', // Set state to pending for re-analysis
            // Preserve existing storage path and public URL if they exist
            storage_path: message.storage_path,
            public_url: message.public_url,
          })
          .eq("id", messageId);

        if (updateError) {
          console.error(`[${correlationId}] Error updating database for message ${messageId}:`, updateError);
          await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'db_update' }, updateError.message);
          throw new Error(`Database update error: ${updateError.message}`);
        }
        await logProcessingEvent('caption_update_db_success', messageId, correlationId);

        // --- Trigger Re-analysis ---
        // No need to await this, let it run in the background
        console.log(`[${correlationId}] Invoking parse-caption function for message ${messageId}`);
        supabaseClient.functions.invoke("parse-caption", {
          body: {
            messageId: messageId, // Pass DB ID
            media_group_id: message.media_group_id,
            caption: newCaption, // Pass the new caption
            isEdit: true, // Indicate this is an edit context
            correlationId: correlationId, // Pass correlation ID
          },
        }).then(({ error: invokeError }: { error: any }) => { // Add type annotation for invokeError
            if (invokeError) {
                const errorMessage = invokeError instanceof Error ? invokeError.message : String(invokeError);
                console.error(`[${correlationId}] Error invoking parse-caption for message ${messageId}:`, errorMessage);
                // Log this failure, but don't fail the main request
                logProcessingEvent('caption_reparse_invoke_failed', messageId, correlationId, {}, errorMessage);
            } else {
                 console.log(`[${correlationId}] Successfully invoked parse-caption for message ${messageId}`);
                 logProcessingEvent('caption_reparse_invoked', messageId, correlationId);
            }
        });

      } catch (dbUpdateError: unknown) {
          const errorMessage = dbUpdateError instanceof Error ? dbUpdateError.message : "DB update failed";
          if (!errorMessage.startsWith('Database update error')) {
             console.error(`[${correlationId}] Exception updating database for message ${messageId}: ${errorMessage}`);
             await logProcessingEvent('caption_update_failed', messageId, correlationId, { stage: 'db_update_exception' }, errorMessage);
          }
          throw new Error(`Database update error: ${errorMessage}`);
      }
    } else {
         // Should not happen if logic above is correct, but as a safeguard
         console.error(`[${correlationId}] Database update skipped because Telegram update failed for message ${messageId}.`);
         // Throw error because the primary action (Telegram update) failed critically
         throw new Error(`Caption update failed: Telegram API error prevented database update.`);
    }


    // --- Success Response ---
    console.log(`[${correlationId}] Caption update process completed successfully for message ${messageId}.`);
    return createSuccessResponse({ success: true, message: "Caption updated and re-analysis triggered" }, correlationId);

  } catch (error: unknown) {
    // Catch errors thrown from steps above
    const errorMessage = error instanceof Error ? error.message : "Unknown error updating caption";
    // Avoid double logging if already logged
    if (!errorMessage.includes('error:')) {
        console.error(`[${correlationId}] Top-level error updating caption for message ${messageId}: ${errorMessage}`);
        // Optionally log here if needed
        // await logProcessingEvent('caption_update_failed', messageId || 'unknown', correlationId, { stage: 'top_level' }, errorMessage);
    }
    throw error; // Re-throw for unifiedHandler
  }
}

// Create and configure the handler
const handler = createHandler(handleUpdateCaption)
  .withMethods(['POST'])
  .withSecurity(SecurityLevel.AUTHENTICATED) // Updating requires authentication
  .build();

// Serve the handler
serve(handler);

console.log("update-telegram-caption function deployed and listening.");
