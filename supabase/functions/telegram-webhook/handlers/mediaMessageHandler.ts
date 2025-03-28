import { logProcessingEvent } from "../../_shared/auditLogger.ts"; // Import from dedicated module
import { constructTelegramMessageUrl } from "../../_shared/consolidatedMessageUtils.ts"; // Only need constructTelegramMessageUrl
import { corsHeaders } from "../../_shared/cors.ts";
import { xdelo_processMessageMedia } from "../../_shared/mediaStorage.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
// Removed createMessage import from dbOperations.ts
import {
  ForwardInfo,
  MessageContext,
  TelegramMessage
} from "../types.ts";

interface DenoRuntime {
  env: {
    get(key: string): string | undefined;
  };
}

declare const Deno: DenoRuntime;

// Validate and get Telegram bot token from environment
const getTelegramBotToken = (): string => {
  if (typeof Deno !== "undefined" && typeof Deno?.env?.get === "function") {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token)
      throw new Error("Missing TELEGRAM_BOT_TOKEN in Deno environment");
    return token;
  }
  // Removed process.env fallback as it causes TS errors in Deno context
  throw new Error("Missing TELEGRAM_BOT_TOKEN environment variable or Deno environment not detected");
};

const TELEGRAM_BOT_TOKEN = getTelegramBotToken();

// Rest of the file remains the same but can safely use TELEGRAM_BOT_TOKEN as string

/**
 * Telegram Webhook Message Processing Flow
 * ... (comments remain the same) ...
 */
export async function handleMediaMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage, logger } = context;

    logger?.info(`Processing ${isEdit ? "edited" : "new"} media message`, {
      message_id: message.message_id,
      chat_id: message.chat.id,
    });

    let response;

    if (isEdit && previousMessage) {
      response = await xdelo_handleEditedMediaMessage(
        message,
        context,
        previousMessage
      );
    } else {
      response = await xdelo_handleNewMediaMessage(message, context);
    }

    return response;
  } catch (error: unknown) { // Added type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.logger?.error(`Error processing media message: ${errorMessage}`, {
      error: error instanceof Error ? error : { message: errorMessage },
      message_id: message.message_id,
      chat_id: message.chat?.id,
    });

    try {
      await logProcessingEvent( // Use imported logProcessingEvent
        "media_processing_error", // eventType
        message.message_id.toString(), // entityId
        context.correlationId, // correlationId
        errorMessage // errorMessage
      );
    } catch (logError: unknown) { // Added type annotation
      const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
      context.logger?.error(
        `Failed to log error to database: ${logErrorMessage}`
      );
    }

    // Return 500 for internal errors, but the main handler might override to 200 for Telegram
    return new Response(
      JSON.stringify({
        error: errorMessage,
        correlationId: context.correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500, // Indicate internal server error
      }
    );
  }
}

/**
 * Helper function to handle edited media messages (Refactored)
 */
async function xdelo_handleEditedMediaMessage(
  message: TelegramMessage,
  context: MessageContext,
  _previousMessage: TelegramMessage // previousMessage is no longer needed here
): Promise<Response> {
  const { correlationId, logger } = context;
  const isChannelPost = message.sender_chat?.type === 'channel';
  const editSource = isChannelPost ? 'channel' : 'user';

  // Fetch existing message details needed for comparison/update
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from("messages")
    .select("id, caption, file_unique_id") // Only need ID, caption, file_unique_id
    .eq("telegram_message_id", message.message_id)
    .eq("chat_id", message.chat.id)
    .single();

  if (lookupError && lookupError.code !== 'PGRST116') { // Handle errors other than "not found"
    logger?.error(
      `Failed to lookup existing message for edit: ${lookupError.message}`
    );
    throw new Error(`Database lookup failed for edited message: ${lookupError.message}`);
  }

  if (existingMessage) { // We found the message by telegram_message_id and chat_id
    logger?.info(`Processing edit for message ${message.message_id} (DB ID: ${existingMessage.id})`);

    // --- Refactor: Use handle_message_edit RPC ---

    // Determine if caption changed
    const captionChanged = existingMessage.caption !== message.caption;
    // Media reprocessing logic might need refinement. For now, let's assume
    // we don't re-download media on edit unless explicitly required later.
    // The SQL function `handle_message_edit` primarily updates metadata.

    // Call the RPC function to handle the edit
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('handle_message_edit', {
      p_message_id: existingMessage.id,
      p_telegram_message_id: message.message_id,
      p_chat_id: message.chat.id,
      p_new_text: null, // No text for media messages
      p_new_caption: message.caption,
      p_telegram_data: message, // Pass the full new message object as telegram_data
      p_is_channel_post: isChannelPost,
      p_edit_source: editSource
    });

    if (rpcError) {
      logger?.error(`Error calling handle_message_edit RPC: ${rpcError.message}`);
      throw rpcError;
    }

    if (rpcResult?.status !== 'success') {
       logger?.error(`RPC handle_message_edit failed: ${rpcResult?.message || 'Unknown RPC error'}`, { rpcResult });
       throw new Error(rpcResult?.message || 'Failed to update message via RPC');
    }

    logger?.success(`Successfully updated message ${existingMessage.id} via RPC`, { rpcResult });

    // Log specific edit event (optional, as trigger handles history)
    try {
       const eventType = captionChanged ? "message_caption_edited" : "message_edit_received";
       await logProcessingEvent(
           eventType,
           existingMessage.id,
           correlationId,
           { edit_history_id: rpcResult?.edit_history_id }
       );
    } catch (logError: unknown) {
       const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
       logger?.error(`Failed to log edit operation event: ${logErrorMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: existingMessage.id,
        correlationId,
        action: 'updated',
        edit_history_id: rpcResult?.edit_history_id,
        edit_count: rpcResult?.edit_count
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } else {
    // If existing message not found by telegram_message_id/chat_id, treat as potentially new
    // Fallback to handle_media_message RPC, passing is_edit: true
    logger?.warn(
      `Original message not found for edit ${message.message_id}. Handling via handle_media_message with is_edit=true.`
    );

    // Need to process media first as if it were new
    const telegramFile = message.photo
      ? message.photo[message.photo.length - 1]
      : message.video || message.document;

    if (!telegramFile?.file_id || !telegramFile?.file_unique_id) {
      throw new Error("Essential media file details missing in edited message fallback");
    }

    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );

    if (!mediaResult.success) {
      throw new Error(`Failed to process media during edit fallback: ${mediaResult.error}`);
    }

    // Prepare media_data for handle_media_message RPC
    const mediaData = {
      ...message, // Include all fields from the message
      is_edit: true, // Indicate this originated from an edit event
      edit_source: editSource,
      is_channel_post: isChannelPost,
      correlation_id: correlationId,
      // Add media processing results
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url,
      mime_type: mediaResult.fileInfo.mime_type,
      file_size: mediaResult.fileInfo.file_size || telegramFile.file_size,
      storage_exists: true,
      storage_path_standardized: true,
      // Add forward info if present
      forward_info: message.forward_origin ? { /* ... forward info fields ... */ } : undefined,
      message_url: constructTelegramMessageUrl(message.chat.id, message.message_id),
    };

    // Call handle_media_message RPC
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('handle_media_message', {
      p_telegram_message_id: message.message_id,
      p_chat_id: message.chat.id,
      p_file_unique_id: telegramFile.file_unique_id,
      p_media_data: mediaData
    });

    if (rpcError) {
      logger?.error(`Error calling handle_media_message RPC during edit fallback: ${rpcError.message}`);
      throw rpcError;
    }

    // Check the status returned by the RPC
    if (!rpcResult?.message_id) {
       logger?.error(`RPC handle_media_message failed during edit fallback: ${rpcResult?.status || 'Unknown RPC error'}`, { rpcResult });
       throw new Error(rpcResult?.status || 'Failed to create/update message via RPC during edit fallback');
    }

    logger?.success(`Successfully handled edited message (original not found) via handle_media_message RPC. DB ID: ${rpcResult.message_id}, Status: ${rpcResult.status}`);

    // Log event
    try {
       await logProcessingEvent(
           "message_created_from_edit_fallback",
           rpcResult.message_id,
           correlationId
       );
    } catch (logError: unknown) {
       const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
       logger?.error(`Failed to log edit fallback operation event: ${logErrorMessage}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: rpcResult.message_id,
        correlationId,
        action: rpcResult.status === 'new' ? 'created_from_edit' : 'updated_from_edit_fallback', // More specific action
        status: rpcResult.status
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handler for new media messages
 */
async function xdelo_handleNewMediaMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  const { correlationId, logger } = context;
  const isChannelPost = message.sender_chat?.type === 'channel';

  try {
    // Construct the message URL for referencing
    const messageUrl = constructTelegramMessageUrl(
      message.chat.id,
      message.message_id
    );

    logger?.info(`Processing new media message: ${message.message_id}`, {
      chat_id: message.chat.id,
      message_url: messageUrl,
    });

    // --- Refactor: Use handle_media_message RPC ---

    // 1. Extract media file details
    const telegramFile = message.photo
      ? message.photo[message.photo.length - 1]
      : message.video || message.document;

    if (!telegramFile?.file_id || !telegramFile?.file_unique_id) {
      logger?.error("Essential media file details missing", { message_id: message.message_id });
      throw new Error("Essential media file details missing");
    }

    // 2. Download and store media (still required before calling RPC)
    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );

    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
    }

    // 3. Prepare forward info
    const forwardInfo: ForwardInfo | undefined = message.forward_origin
      ? {
          is_forwarded: true,
          forward_origin_type: message.forward_origin.type,
          forward_from_chat_id: message.forward_origin.chat?.id,
          forward_from_chat_title: message.forward_origin.chat?.title,
          forward_from_chat_type: message.forward_origin.chat?.type,
          forward_from_message_id: message.forward_origin.message_id,
          forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
          original_chat_id: message.forward_origin.chat?.id,
          original_chat_title: message.forward_origin.chat?.title,
          original_message_id: message.forward_origin.message_id,
        }
      : undefined;

    // 4. Prepare media_data payload for the RPC function
    const mediaData = {
      // Include all relevant fields from the message object
      ...message,
      // Add context and processing results
      is_edit: false, // This is a new message
      is_channel_post: isChannelPost,
      correlation_id: correlationId,
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url,
      mime_type: mediaResult.fileInfo.mime_type,
      file_size: mediaResult.fileInfo.file_size || telegramFile.file_size,
      storage_exists: true,
      storage_path_standardized: true,
      forward_info: forwardInfo,
      message_url: messageUrl,
      // Ensure file details are included if not already part of ...message
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      width: telegramFile && "width" in telegramFile ? telegramFile.width : undefined,
      height: telegramFile && "height" in telegramFile ? telegramFile.height : undefined,
      duration: message.video?.duration,
      mime_type_original: message.document?.mime_type || message.video?.mime_type,
    };

    // 5. Check for existing media group duplicates before processing
    if (message.media_group_id) {
      const { data: existingMedia, error: lookupError } = await supabaseClient
        .from('messages')
        .select('id, processing_state')
        .eq('media_group_id', message.media_group_id)
        .eq('file_unique_id', telegramFile.file_unique_id)
        .maybeSingle();

      if (lookupError) {
        logger?.error(`Error checking for media duplicates: ${lookupError.message}`);
        throw lookupError;
      }

      if (existingMedia) {
        logger?.warn(`Duplicate media detected in media group`, {
          existing_id: existingMedia.id,
          file_unique_id: telegramFile.file_unique_id,
          media_group_id: message.media_group_id
        });

        return new Response(
          JSON.stringify({
            success: true,
            id: existingMedia.id,
            correlationId,
            status: 'duplicate',
            action: 'skipped'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Call the handle_media_message RPC function
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc('handle_media_message', {
      p_telegram_message_id: message.message_id,
      p_chat_id: message.chat.id,
      p_file_unique_id: telegramFile.file_unique_id,
      p_media_data: mediaData
    });

    if (rpcError) {
      logger?.error(`Error calling handle_media_message RPC: ${rpcError.message}`);
      // Check for specific unique constraint errors if needed, though the RPC should handle it
      if (rpcError.code === '23505') { // Example: Check for unique violation
         logger?.warn(`Potential duplicate detected by RPC: ${rpcError.message}`);
         // The RPC should ideally return a status indicating duplication
      }
      throw rpcError;
    }

    // 6. Process the RPC response
    if (!rpcResult?.message_id) {
       logger?.error(`RPC handle_media_message failed: ${rpcResult?.status || 'Unknown RPC error'}`, { rpcResult });
       throw new Error(rpcResult?.status || 'Failed to create/update message via RPC');
    }

    logger?.success(`Successfully processed new media message via RPC. DB ID: ${rpcResult.message_id}, Status: ${rpcResult.status}`);

    // Log event based on RPC status
    try {
       const eventType = rpcResult.status === 'new' ? "message_created" : "message_duplicate_handled";
       await logProcessingEvent(
           eventType,
           rpcResult.message_id,
           correlationId,
           { rpc_status: rpcResult.status } // Add RPC status to metadata
       );
    } catch (logError: unknown) {
       const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
       logger?.error(`Failed to log new message operation event: ${logErrorMessage}`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        id: rpcResult.message_id,
        correlationId,
        status: rpcResult.status, // Include status from RPC
        needs_processing: rpcResult.needs_processing // Include processing flag
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (createError: unknown) { // Added type annotation
    const createErrorMessage = createError instanceof Error ? createError.message : String(createError);
    logger?.error(
      `Error in xdelo_handleNewMediaMessage: ${createErrorMessage}`,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        media_group_id: message.media_group_id,
        error_type: typeof createError,
        error_keys: typeof createError === "object" && createError !== null ? Object.keys(createError) : "N/A",
      }
    );

    // Log detailed error to database using 4-arg wrapper
    try {
      await logProcessingEvent( // Use imported logProcessingEvent
        "media_processing_error", // eventType
        message.message_id.toString(), // entityId
        correlationId, // correlationId
        createErrorMessage // errorMessage
      );
    } catch (logError: unknown) { // Added type annotation
      const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
      console.error(
        `Error logging failure in xdelo_handleNewMediaMessage: ${logErrorMessage}`
      );
    }

    // Re-throw to be caught by the main handler
    throw createError;
  }
}
