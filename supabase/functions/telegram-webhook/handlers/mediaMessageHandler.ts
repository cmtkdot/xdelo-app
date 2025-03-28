import { corsHeaders } from "../../_shared/cors.ts";
import { syncMediaGroupContent } from "../../_shared/mediaGroupSync.ts";
import { xdelo_processMessageMedia } from "../../_shared/mediaStorage.ts";
import { xdelo_detectMimeType } from "../../_shared/mediaUtils.ts";
import { constructTelegramMessageUrl, logProcessingEvent } from "../../_shared/consolidatedMessageUtils.ts"; // Import logProcessingEvent
import { supabaseClient } from "../../_shared/supabase.ts";
import {
  createMessage,
  // triggerCaptionAnalysis, // Removed - No longer used
  // xdelo_logProcessingEvent, // Removed import
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
 *
 * 1. Webhook receives message from Telegram
 * 2. Message is routed to appropriate handler (media/text/etc)
 * 3. For media messages:
 *    a. Validate required fields (file_id, file_unique_id)
 *    b. Process media file (download, store, generate public URL)
 *    c. Create/update message record in database
 *    d. Handle duplicates and edits
 *    e. Trigger downstream processing via database triggers
 *
 * Key Components:
 * - handleMediaMessage: Main entry point
 * - xdelo_handleNewMediaMessage: New message processing
 * - xdelo_handleEditedMediaMessage: Edit processing
 * - createMessage: Database record creation (shared with other handlers)
 *
 * Error Handling:
 * - All errors are caught and logged to database
 * - Processing continues where possible
 * - Detailed error context is preserved
 */
export async function handleMediaMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  try {
    const { correlationId, isEdit, previousMessage, logger } = context;

    // Parse and validate incoming message
    // - Extract core message metadata
    // - Verify required fields
    // - Initialize processing context
    logger?.info(`Processing ${isEdit ? "edited" : "new"} media message`, {
      message_id: message.message_id,
      chat_id: message.chat.id,
    });

    let response;

    // Message Routing Logic
    // - Edited messages: Process updates and track history
    // - New messages: Full processing pipeline
    // - Maintains data consistency across edits
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

    // Also log to database for tracking using 4-arg wrapper
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

    return new Response(
      JSON.stringify({
        error: errorMessage,
        correlationId: context.correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Helper function to handle edited media messages
 */
async function xdelo_handleEditedMediaMessage(
  message: TelegramMessage,
  context: MessageContext,
  previousMessage: TelegramMessage
): Promise<Response> {
  const { correlationId, logger } = context;

  // Edit Processing Workflow
  // 1. Retrieve existing message record
  // 2. Compare changes (media/caption/both)
  // 3. Update storage if media changed
  // 4. Maintain edit history
  // 5. Preserve original file references
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("telegram_message_id", message.message_id)
    .eq("chat_id", message.chat.id)
    .single();

  if (lookupError) {
    logger?.error(
      `Failed to lookup existing message for edit: ${lookupError.message}`
    );
    throw new Error(`Database lookup failed: ${lookupError.message}`);
  }

  if (existingMessage) {
    // Store previous state in edit_history
    let editHistory = existingMessage.edit_history || [];
    editHistory.push({
      timestamp: new Date().toISOString(),
      previous_caption: existingMessage.caption,
      previous_processing_state: existingMessage.processing_state,
      edit_source: "telegram_edit",
      edit_date: message.edit_date
        ? new Date(message.edit_date * 1000).toISOString()
        : new Date().toISOString(),
    });

    // Determine what has changed
    const captionChanged = existingMessage.caption !== message.caption;
    const hasNewMedia = message.photo || message.video || message.document;

    // If media has been updated, handle the new media
    if (hasNewMedia) {
      try {
        logger?.info(
          `Media has changed in edit for message ${message.message_id}`
        );

        // Determine the current file details
        const telegramFile = message.photo
          ? message.photo[message.photo.length - 1]
          : message.video || message.document;

        // Check immediately if media file details are present in the edited message
        if (
          !telegramFile ||
          !telegramFile.file_id ||
          !telegramFile.file_unique_id
        ) {
          logger?.error(
            "Essential media file details missing from edited message",
            { message_id: message.message_id }
          );
          throw new Error(
            "Essential media file details missing from edited message"
          );
        }

        // Get mime type
        const detectedMimeType = xdelo_detectMimeType(message);

        // Process the new media file
        const mediaProcessResult = await xdelo_processMessageMedia(
          message,
          telegramFile.file_id,
          telegramFile.file_unique_id,
          TELEGRAM_BOT_TOKEN,
          existingMessage.id // Use existing message ID
        );

        if (!mediaProcessResult.success) {
          throw new Error(
            `Failed to process edited media: ${mediaProcessResult.error}`
          );
        }

        // If successful, update the message with new media info
        const { data: updateResult, error: updateError } = await supabaseClient
          .from("messages")
          .update({
            caption: message.caption,
            file_id: telegramFile.file_id,
            file_unique_id: telegramFile.file_unique_id,
            mime_type: detectedMimeType,
            // Safely access width/height, defaulting to undefined if not applicable (e.g., for documents)
            width: "width" in telegramFile ? telegramFile.width : undefined,
            height: "height" in telegramFile ? telegramFile.height : undefined,
            duration: message.video?.duration,
            file_size: telegramFile.file_size,
            edit_date: message.edit_date
              ? new Date(message.edit_date * 1000).toISOString()
              : new Date().toISOString(),
            edit_count: (existingMessage.edit_count || 0) + 1,
            edit_history: editHistory,
            processing_state: message.caption
              ? "pending"
              : existingMessage.processing_state,
            storage_path: mediaProcessResult.fileInfo.storage_path,
            public_url: mediaProcessResult.fileInfo.public_url,
            last_edited_at: new Date().toISOString(),
          })
          .eq("id", existingMessage.id);

        if (updateError) {
          throw new Error(
            `Failed to update message with new media: ${updateError.message}`
          );
        }

        // Log the edit operation using 4-arg wrapper
        try {
          await logProcessingEvent( // Use imported logProcessingEvent
            "message_media_edited", // eventType
            existingMessage.id, // entityId
            correlationId, // correlationId
            undefined // errorMessage
          );
        } catch (logError: unknown) { // Added type annotation
          const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
          logger?.error(
            `Failed to log media edit operation: ${logErrorMessage}`
          );
        }
      } catch (mediaError: unknown) { // Added type annotation
        const mediaErrorMessage = mediaError instanceof Error ? mediaError.message : String(mediaError);
        logger?.error(`Error processing edited media: ${mediaErrorMessage}`);
        throw mediaError; // Re-throw original error
      }
    }
    // If only caption has changed, just update the caption
    else if (captionChanged) {
      logger?.info(
        `Caption has changed in edit for message ${message.message_id}`
      );

      // Update just the caption
      // The DB trigger 'trg_process_caption' will handle setting state to 'pending'
      const { error: updateError } = await supabaseClient
        .from("messages")
        .update({
          caption: message.caption,
          edit_date: message.edit_date
            ? new Date(message.edit_date * 1000).toISOString()
            : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          // processing_state is handled by the trigger now
          // processing_state: message.caption
          //   ? "pending"
          //   : existingMessage.processing_state,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", existingMessage.id);

      if (updateError) {
        throw new Error(
          `Failed to update message caption: ${updateError.message}`
        );
      }

      // Log the caption edit using 4-arg wrapper
      try {
        await logProcessingEvent( // Use imported logProcessingEvent
          "message_caption_edited", // eventType
          existingMessage.id, // entityId
          correlationId, // correlationId
          undefined // errorMessage
        );
      } catch (logError: unknown) { // Added type annotation
        const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
        logger?.error(
          `Failed to log caption edit operation: ${logErrorMessage}`
        );
      }
    } else {
      // No significant changes detected
      logger?.info(
        `No significant changes detected in edit for message ${message.message_id}`
      );

      // Still update the edit metadata
      const { error: updateError } = await supabaseClient
        .from("messages")
        .update({
          edit_date: message.edit_date
            ? new Date(message.edit_date * 1000).toISOString()
            : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          last_edited_at: new Date().toISOString(),
        })
        .eq("id", existingMessage.id);

      if (updateError) {
        logger?.warn(`Failed to update edit metadata: ${updateError.message}`);
      }

      // Log the edit operation anyway using 4-arg wrapper
      try {
        await logProcessingEvent( // Use imported logProcessingEvent
          "message_edit_received", // eventType
          existingMessage.id, // entityId
          correlationId, // correlationId
          undefined // errorMessage
        );
      } catch (logError: unknown) { // Added type annotation
        const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
        console.error("Error logging edit operation:", logErrorMessage);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If existing message not found, handle as new message
  logger?.info(
    `Original message not found, creating new message for edit ${message.message_id}`
  );
  return await xdelo_handleNewMediaMessage(message, context);
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

    // Create message input
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
      // Safely access width/height, defaulting to undefined if not applicable
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
      processing_state: message.caption ? "pending" : "initialized",
      is_edited_channel_post: context.isChannelPost,
      forward_info: forwardInfo,
      telegram_data: message,
      edit_date: message.edit_date
        ? new Date(message.edit_date * 1000).toISOString()
        : undefined,
      is_forward: context.isForwarded,
      edit_history: context.isEdit
        ? [
            {
              timestamp: new Date().toISOString(),
              is_initial_edit: true,
              edit_date: message.edit_date
                ? new Date(message.edit_date * 1000).toISOString()
                : new Date().toISOString(),
            },
          ]
        : [],
      storage_exists: true,
      storage_path_standardized: true,
      message_url: messageUrl,
    };

    /**
     * Database Operation with Retry Logic
     *
     * Duplicate Detection Flow:
     * 1. Checks for existing messages with same file_unique_id
     * 2. If duplicate found:
     *    - Sets is_duplicate: true
     *    - Sets duplicate_reference_id to original message ID
     *    - Returns original message details
     * 3. If no duplicate:
     *    - Creates new message record
     *    - Sets is_duplicate: false
     *    - Leaves duplicate_reference_id undefined
     *
     * Also handles:
     * - Transient failures with exponential backoff
     * - Timeout protection
     */
    const enhancedMessageInput: MessageInput = {
      ...messageInput,
      is_duplicate: false, // Updated by createMessage if duplicate detected
      duplicate_reference_id: undefined, // Set to original message ID if duplicate
    };

    // Remove supabaseClient argument from createMessage call
    const result = await createMessage(
      enhancedMessageInput,
      logger
    );

    if (result.duplicate && logger) {
      logger.warn(`Duplicate message detected and handled`, {
        message_id: result.id,
        telegram_message_id: message.message_id,
        file_unique_id: messageInput.file_unique_id,
      });
    }

    if (!result.success) {
      logger?.error(`Failed to create message: ${result.error_message}`, {
        message_id: message.message_id,
        chat_id: message.chat.id,
      });

      // Also try to log to the database using 4-arg wrapper
      await logProcessingEvent( // Use imported logProcessingEvent
        "message_creation_failed", // eventType
        message.message_id.toString(), // entityId
        correlationId, // correlationId
        result.error_message // errorMessage
      );

      throw new Error(
        result.error_message || "Failed to create message record"
      );
    }

    // Log the success
    logger?.success(`Successfully created new media message: ${result.id}`, {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      media_type: message.photo
        ? "photo"
        : message.video
        ? "video"
        : "document",
      storage_path: mediaResult.fileInfo.storage_path,
    });

    // If message has caption, the database trigger 'trg_process_caption'
    // will set its state to 'pending' automatically.
    if (message.caption && result.id) {
      logger?.info(
        `Message ${result.id} has caption, DB trigger will set state to 'pending'.`
      );
    }

    // Only sync media group if this is part of one AND has analyzed content
    if (message.media_group_id && result.id && message.caption) {
      try {
        logger?.info(
          `Starting media group sync for group ${message.media_group_id}`
        );
        const syncResult = await syncMediaGroupContent(
          result.id,
          {
            media_group_id: message.media_group_id,
            caption: message.caption,
          },
          {
            forceSync: true,
            syncEditHistory: false,
          }
        );
        logger?.info(
          `Media group sync completed: ${JSON.stringify(syncResult)}`
        );
      } catch (syncError: unknown) { // Added type annotation
        const syncErrorMessage = syncError instanceof Error ? syncError.message : String(syncError);
        logger?.error(`Media group sync failed: ${syncErrorMessage}`);
        // Non-fatal error, continue
      }
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id, correlationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (createError: unknown) { // Added type annotation
    const createErrorMessage = createError instanceof Error ? createError.message : String(createError);
    logger?.error(
      `Error creating new media message: ${createErrorMessage}`,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        media_group_id: message.media_group_id,
        error_type: typeof createError,
        // Added null check for Object.keys
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
        `Error logging failure: ${logErrorMessage}`
      );
    }

    // Re-throw to be caught by the main handler
    throw createError;
  }
}
