import { logProcessingEvent } from "../../_shared/auditLogger.ts"; // Import from dedicated module
import { constructTelegramMessageUrl } from "../../_shared/consolidatedMessageUtils.ts"; // Only need constructTelegramMessageUrl
import { corsHeaders } from "../../_shared/cors.ts";
import { xdelo_processMessageMedia } from "../../_shared/mediaStorage.ts";
import { xdelo_detectMimeType } from "../../_shared/mediaUtils.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
import {
  createMessage,
} from "../dbOperations.ts";
import {
  ForwardInfo,
  MessageContext,
  MessageInput,
  TelegramMessage,
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
  previousMessage: TelegramMessage // previousMessage is passed but not used after refactor
): Promise<Response> {
  const { correlationId, logger } = context;

  // Fetch existing message details needed for comparison/update
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from("messages")
    .select("id, caption, file_unique_id, edit_count, edit_history, processing_state, forward_info, storage_path, public_url, mime_type, mime_type_original, width, height, duration, file_size, storage_exists, storage_path_standardized") // Select necessary fields
    .eq("telegram_message_id", message.message_id)
    .eq("chat_id", message.chat.id)
    .single();

  if (lookupError) {
    logger?.error(
      `Failed to lookup existing message for edit: ${lookupError.message}`
    );
    // If lookup fails, maybe treat as new? Or throw? Let's throw for now.
    throw new Error(`Database lookup failed for edited message: ${lookupError.message}`);
  }

  if (existingMessage) { // We found the message by telegram_message_id and chat_id
    logger?.info(`Processing edit for message ${message.message_id} (DB ID: ${existingMessage.id})`);

    // --- Refactor: Use createMessage for consistent upsert/duplicate handling ---

    // Determine what has changed
    const captionChanged = existingMessage.caption !== message.caption;
    const hasNewMedia = !!(message.photo || message.video || message.document); // Ensure boolean
    const shouldProcessMedia = captionChanged && hasNewMedia; // Process media only if caption changed AND new media present

    // Prepare base input for createMessage, merging new and existing data
    const messageInput: Partial<MessageInput> & { telegram_message_id: number; chat_id: number } = { // Ensure core IDs are present
      // Core identifiers remain the same for update
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      // Fields from the incoming edited message
      caption: message.caption,
      media_group_id: message.media_group_id,
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
      telegram_data: message, // Store the latest raw message data
      // Contextual info
      correlation_id: correlationId,
      is_edited_channel_post: context.isChannelPost,
      is_forward: context.isForwarded, // Re-evaluate based on edited message? Assuming it doesn't change.
      // Rebuild ForwardInfo if present in the edited message, otherwise keep existing
      forward_info: message.forward_origin
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
        : existingMessage.forward_info,
      message_url: constructTelegramMessageUrl(message.chat.id, message.message_id), // Update URL just in case
      // Edit tracking
      edit_count: (existingMessage.edit_count || 0) + 1,
      edit_history: [
        ...(existingMessage.edit_history || []), // Append to existing history
        {
          timestamp: new Date().toISOString(),
          previous_caption: existingMessage.caption, // Capture state before potential update
          previous_processing_state: existingMessage.processing_state,
          edit_source: "telegram_edit", // Mark source as Telegram edit
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
        }
      ],
      // Default fields from existing message (will be overwritten if media processed)
      file_id: existingMessage.file_id,
      file_unique_id: existingMessage.file_unique_id,
      mime_type: existingMessage.mime_type,
      mime_type_original: existingMessage.mime_type_original,
      storage_path: existingMessage.storage_path,
      public_url: existingMessage.public_url,
      width: existingMessage.width,
      height: existingMessage.height,
      duration: existingMessage.duration,
      file_size: existingMessage.file_size,
      storage_exists: existingMessage.storage_exists,
      storage_path_standardized: existingMessage.storage_path_standardized,
      // processing_state will be handled by createMessage/trigger based on caption change
    };

    // If media needs reprocessing
    if (shouldProcessMedia) {
      logger?.info(`Caption and media changed, reprocessing media for ${message.message_id}`);
      const telegramFile = message.photo
        ? message.photo[message.photo.length - 1]
        : message.video || message.document!;

      if (!telegramFile?.file_id || !telegramFile?.file_unique_id) {
        throw new Error("Essential media file details missing in edited message despite media presence");
      }

      try {
        const mediaProcessResult = await xdelo_processMessageMedia(
          message,
          telegramFile.file_id,
          telegramFile.file_unique_id,
          TELEGRAM_BOT_TOKEN,
          existingMessage.id // Use existing message ID for storage path context
        );

        if (!mediaProcessResult.success) {
          throw new Error(`Failed to process edited media: ${mediaProcessResult.error}`);
        }

        // Overwrite relevant fields in messageInput with new media details
        messageInput.file_id = telegramFile.file_id;
        messageInput.file_unique_id = telegramFile.file_unique_id; // Pass the new one to createMessage
        messageInput.mime_type = mediaProcessResult.fileInfo.mime_type;
        messageInput.mime_type_original = message.document?.mime_type || message.video?.mime_type;
        messageInput.storage_path = mediaProcessResult.fileInfo.storage_path;
        messageInput.public_url = mediaProcessResult.fileInfo.public_url;
        messageInput.width = "width" in telegramFile ? telegramFile.width : undefined;
        messageInput.height = "height" in telegramFile ? telegramFile.height : undefined;
        messageInput.duration = message.video?.duration;
        messageInput.file_size = telegramFile.file_size || mediaProcessResult.fileInfo.file_size;
        messageInput.storage_exists = true; // Assume true after successful processing
        messageInput.storage_path_standardized = true; // Assume true after successful processing

      } catch (mediaError: unknown) {
        const mediaErrorMessage = mediaError instanceof Error ? mediaError.message : String(mediaError);
        logger?.error(`Error processing edited media: ${mediaErrorMessage}`);
        // Log error but potentially continue to update caption via createMessage if needed?
        // For now, re-throw to maintain previous behavior.
        throw mediaError;
      }
    } else {
       logger?.info(`Edit received for ${message.message_id}. Media processing not required (caption unchanged or no new media).`);
       // Ensure file_unique_id from existing message is passed if no new media processing
       messageInput.file_unique_id = existingMessage.file_unique_id;
    }

    // Call createMessage to handle the upsert logic
    const result = await createMessage(messageInput, logger);

    if (!result.success) {
      logger?.error(`createMessage failed during edit handling: ${result.error_message}`, {
        message_id: message.message_id,
        existing_db_id: existingMessage.id,
      });
      // Throw error to be caught by the main handler -> returns 200 OK to Telegram
      throw new Error(result.error_message || "Failed to update message via createMessage");
    }

    logger?.success(`Successfully processed edit for message ${message.message_id} (DB ID: ${result.id}). Duplicate: ${result.duplicate}, Caption Changed: ${result.caption_changed}`);

    // Log specific edit event
    try {
       const eventType = shouldProcessMedia ? "message_media_caption_edited" : (captionChanged ? "message_caption_edited" : "message_edit_received");
       await logProcessingEvent(eventType, result.id!, correlationId);
    } catch (logError: unknown) {
       const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
       logger?.error(`Failed to log edit operation event: ${logErrorMessage}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id, correlationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } else {
    // If existing message not found by telegram_message_id/chat_id, treat as potentially new
    // This could happen if the original message wasn't processed or was deleted.
    // Fallback to handleNewMediaMessage which uses createMessage internally.
    logger?.warn(
      `Original message not found for edit ${message.message_id}. Handling as new message.`
    );
    return await xdelo_handleNewMediaMessage(message, context);
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

    // New Message Processing Pipeline
    // 1. Extract media file details
    // 2. Download and store media
    // 3. Generate public URL
    // 4. Create database record
    // 5. Handle duplicates
    // 6. Trigger analysis (via DB triggers)
    const telegramFile = message.photo
      ? message.photo[message.photo.length - 1]
      : message.video || message.document;

    // Check immediately if media file details are present
    if (
      !telegramFile ||
      !telegramFile.file_id ||
      !telegramFile.file_unique_id
    ) {
      logger?.error(
        "Essential media file details (file_id, file_unique_id) missing from message",
        { message_id: message.message_id }
      );
      throw new Error("Essential media file details missing");
    }

    // Always process the media as new
    const mediaResult = await xdelo_processMessageMedia(
      message,
      telegramFile.file_id,
      telegramFile.file_unique_id,
      TELEGRAM_BOT_TOKEN
    );

    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
    }

    // Prepare forward info if message is forwarded
    const forwardInfo: ForwardInfo | undefined = message.forward_origin
      ? {
          is_forwarded: true,
          forward_origin_type: message.forward_origin.type,
          forward_from_chat_id: message.forward_origin.chat?.id,
          forward_from_chat_title: message.forward_origin.chat?.title,
          forward_from_chat_type: message.forward_origin.chat?.type,
          forward_from_message_id: message.forward_origin.message_id,
          forward_date: new Date(
            message.forward_origin.date * 1000
          ).toISOString(),
          original_chat_id: message.forward_origin.chat?.id,
          original_chat_title: message.forward_origin.chat?.title,
          original_message_id: message.forward_origin.message_id,
        }
      : undefined;

    // Create message input for createMessage
    const messageInput: MessageInput = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      caption: message.caption,
      media_group_id: message.media_group_id,
      file_id: telegramFile.file_id,
      file_unique_id: telegramFile.file_unique_id,
      mime_type: mediaResult.fileInfo.mime_type,
      mime_type_original:
        message.document?.mime_type || message.video?.mime_type,
      storage_path: mediaResult.fileInfo.storage_path,
      public_url: mediaResult.fileInfo.public_url,
      width:
        telegramFile && "width" in telegramFile
          ? telegramFile.width
          : undefined,
      height:
        telegramFile && "height" in telegramFile
          ? telegramFile.height
          : undefined,
      duration: message.video?.duration,
      file_size:
        (telegramFile ? telegramFile.file_size : undefined) ||
        mediaResult.fileInfo.file_size,
      correlation_id: correlationId,
      // Initial state is 'pending' if caption exists, otherwise 'initialized'
      // The trigger 'trg_process_caption' will handle setting to 'pending' if caption exists on insert
      processing_state: message.caption ? "pending" : "initialized", // Set initial state hint
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date // Only relevant for edits, handled in xdelo_handleEditedMediaMessage
        ? new Date(message.edit_date * 1000).toISOString()
        : undefined,
      is_forward: context.isForwarded,
      edit_history: context.isEdit // Should generally be false here, but handle defensively
        ? [
            {
              timestamp: new Date().toISOString(),
              is_initial_edit: true, // Mark if somehow an edit lands here
              edit_date: message.edit_date
                ? new Date(message.edit_date * 1000).toISOString()
                : new Date().toISOString(),
            },
          ]
        : [],
      storage_exists: true, // Assume true after successful processing
      storage_path_standardized: true, // Assume true after successful processing
      message_url: messageUrl,
      // is_duplicate and duplicate_reference_id are handled within createMessage
    };

    // Call createMessage to handle insert and duplicate logic
    const result = await createMessage(
      messageInput, // Pass the fully prepared input
      logger
    );

    if (result.duplicate && logger) {
      logger.warn(`Duplicate message detected and handled by createMessage`, {
        message_id: result.id,
        telegram_message_id: message.message_id,
        file_unique_id: messageInput.file_unique_id,
      });

      // Return success response but indicate it was a duplicate
      return new Response(
        JSON.stringify({
          success: true,
          id: result.id,
          correlationId,
          is_duplicate: true,
          duplicate_reference_id: result.duplicate_reference_id
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.success) {
      // Handle duplicate key violation specifically
      if (result.error_message?.includes('duplicate key value violates unique constraint "messages_file_unique_id_key"')) {
        logger?.warn(`Duplicate file_unique_id detected: ${messageInput.file_unique_id}`, {
          message_id: message.message_id,
          chat_id: message.chat.id,
        });

        // Try to find existing message with this file_unique_id
        const { data: existing } = await supabaseClient
          .from('messages')
          .select('id')
          .eq('file_unique_id', messageInput.file_unique_id)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({
              success: true,
              id: existing.id,
              correlationId,
              is_duplicate: true,
              duplicate_reference_id: existing.id
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      logger?.error(`createMessage failed for new message: ${result.error_message}`, {
        message_id: message.message_id,
        chat_id: message.chat.id,
      });

      await logProcessingEvent(
        "message_creation_failed",
        message.message_id.toString(),
        correlationId,
        result.error_message
      );

      throw new Error(
        result.error_message || "Failed to create message record via createMessage"
      );
    }

    // Log the success
    logger?.success(`Successfully processed new media message via createMessage: ${result.id}`, {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      media_type: message.photo
        ? "photo"
        : message.video
        ? "video"
        : "document",
      storage_path: messageInput.storage_path, // Use path from input
      is_duplicate: result.duplicate,
    });

    // Trigger handles setting state to 'pending' if caption exists.

    return new Response(
      JSON.stringify({ success: true, id: result.id, correlationId }),
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
