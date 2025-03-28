
/**
 * Handler for media messages
 */
import { TelegramMessage, MessageContext, MessageProcessResult } from "../types.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
import { buildTelegramMessageUrl } from "../utils/urlBuilder.ts";
import { processMessageMedia } from "../services/mediaService.ts";
import {
  checkExistingMessage,
  checkMediaGroupDuplicate,
  handleEditedMessage,
  createMessage
} from "../services/databaseService.ts";
import {
  createSuccessResponse,
  createTelegramErrorResponse
} from "../services/responseService.ts";
import { logEvent, logErrorEvent } from "../services/loggingService.ts";
import { TELEGRAM_BOT_TOKEN } from "../config/environment.ts";

/**
 * Main handler for media messages (new or edited)
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

    let result: MessageProcessResult;

    if (isEdit) {
      result = await handleEditedMediaMessage(message, context);
    } else {
      result = await handleNewMediaMessage(message, context);
    }

    if (!result.success) {
      throw new Error(result.error || "Unknown error processing media message");
    }

    return createSuccessResponse({
      success: true,
      id: result.id,
      correlationId,
      status: result.status,
      action: result.action,
      edit_history_id: result.editHistoryId,
      edit_count: result.editCount,
      needs_processing: result.needsProcessing
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.logger?.error(`Error processing media message: ${errorMessage}`, {
      error: error instanceof Error ? error : { message: errorMessage },
      message_id: message.message_id,
      chat_id: message.chat?.id,
    });

    try {
      await logErrorEvent(
        "media_processing_error",
        message.message_id.toString(),
        context.correlationId,
        error,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
        }
      );
    } catch (logError) {
      context.logger?.error(
        `Failed to log error to database: ${logError instanceof Error ? logError.message : String(logError)}`
      );
    }

    // Return Telegram compatible error response (status 200)
    return createTelegramErrorResponse(error, context.correlationId);
  }
}

/**
 * Handler for edited media messages
 */
async function handleEditedMediaMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<MessageProcessResult> {
  const { correlationId, logger } = context;
  const isChannelPost = message.sender_chat?.type === 'channel';
  const editSource = isChannelPost ? 'channel' : 'user';

  // Fetch existing message
  const { exists, id: existingMessageId } = await checkExistingMessage(
    message.message_id,
    message.chat.id
  );

  if (exists && existingMessageId) {
    logger?.info(`Processing edit for message ${message.message_id} (DB ID: ${existingMessageId})`);

    // Process media if needed
    const mediaResult = await processMessageMedia(message);

    if (!mediaResult.success) {
      throw new Error(`Failed to process media during edit: ${mediaResult.error}`);
    }

    // Call the edit handler
    const editResult = await handleEditedMessage(
      existingMessageId,
      message.message_id,
      message.chat.id,
      null, // No text for media messages
      message.caption,
      mediaResult.mediaData, // Pass processed media data
      isChannelPost,
      editSource
    );

    if (!editResult.success) {
      throw new Error(`Failed to update message: ${editResult.error}`);
    }

    logger?.success(`Successfully updated message ${existingMessageId}`);

    // Log edit event
    await logEvent(
      "message_media_edited",
      existingMessageId,
      correlationId,
      {
        edit_history_id: editResult.edit_history_id,
        message_id: message.message_id,
        chat_id: message.chat.id
      }
    );

    return {
      success: true,
      id: existingMessageId,
      status: 'updated',
      action: 'updated',
      editHistoryId: editResult.edit_history_id,
      editCount: editResult.edit_count
    };
  } else {
    // If message not found, handle as new message with is_edit flag
    logger?.warn(
      `Original message not found for edit ${message.message_id}. Handling as new message with is_edit=true.`
    );

    // Process media
    const mediaResult = await processMessageMedia(message);

    if (!mediaResult.success) {
      throw new Error(`Failed to process media: ${mediaResult.error}`);
    }

    // Add edit flags to the media data
    const editMediaData = {
      ...mediaResult.mediaData,
      is_edit: true,
      edit_source: editSource,
      is_channel_post: isChannelPost,
      correlation_id: correlationId
    };

    // Create new message record
    const { success, id, status, error_message } = await createMessage({
      ...editMediaData,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      file_unique_id: message.photo
        ? message.photo[message.photo.length - 1].file_unique_id
        : message.video?.file_unique_id || message.document?.file_unique_id
    }, logger);

    if (!success || !id) {
      throw new Error(error_message || "Failed to create message record during edit fallback");
    }

    logger?.success(`Created new message from edit (ID: ${id})`);

    // Log the event
    await logEvent(
      "message_created_from_edit_fallback",
      id,
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id
      }
    );

    return {
      success: true,
      id,
      status,
      action: 'created_from_edit',
      needsProcessing: true
    };
  }
}

/**
 * Handler for new media messages
 */
async function handleNewMediaMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<MessageProcessResult> {
  const { correlationId, logger } = context;
  const isChannelPost = message.sender_chat?.type === 'channel';
  const messageUrl = buildTelegramMessageUrl(message.chat.id, message.message_id);

  logger?.info(`Processing new media message: ${message.message_id}`, {
    chat_id: message.chat.id,
    message_url: messageUrl,
  });

  // Check for existing message first
  const { exists: messageExists, id: existingMessageId, caption: existingCaption } = await checkExistingMessage(
    message.message_id,
    message.chat.id
  );

  if (messageExists && existingMessageId) {
    logger?.info(`Message ${message.message_id} already exists (DB ID: ${existingMessageId})`);

    // For media groups, skip processing if message exists (no captions allowed)
    if (message.media_group_id) {
      return {
        success: true,
        id: existingMessageId,
        status: 'existing',
        action: 'skipped',
        needsProcessing: false
      };
    }

    // For non-media group messages with caption
    if (message.caption) {
      // If caption is the same, skip processing
      if (existingCaption === message.caption) {
        return {
          success: true,
          id: existingMessageId,
          status: 'existing',
          action: 'skipped',
          needsProcessing: false
        };
      }

      // If caption changed, update it without creating edit history
      const { success, error_message } = await supabaseClient
        .from('messages')
        .update({
          caption: message.caption,
          processing_state: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMessageId);

      if (!success) {
        throw new Error(error_message || "Failed to update message caption");
      }

      return {
        success: true,
        id: existingMessageId,
        status: 'updated',
        action: 'caption_updated',
        needsProcessing: true
      };
    }

    // For non-media group messages without caption, skip processing
    return {
      success: true,
      id: existingMessageId,
      status: 'existing',
      action: 'skipped',
      needsProcessing: false
    };
  }

  // Check for media group duplicates
  if (message.media_group_id) {
    const telegramFile = message.photo
      ? message.photo[message.photo.length - 1]
      : message.video || message.document;

    if (telegramFile?.file_unique_id) {
      const { exists: duplicateExists, id: duplicateId } = await checkMediaGroupDuplicate(
        message.media_group_id,
        telegramFile.file_unique_id
      );

      if (duplicateExists && duplicateId) {
        logger?.warn(`Duplicate media detected in media group`, {
          existing_id: duplicateId,
          file_unique_id: telegramFile.file_unique_id,
          media_group_id: message.media_group_id
        });

        return {
          success: true,
          id: duplicateId,
          status: 'duplicate',
          action: 'skipped',
          needsProcessing: false
        };
      }
    }
  }

  // Process media
  const mediaResult = await processMessageMedia(message);

  if (!mediaResult.success) {
    throw new Error(`Failed to process media: ${mediaResult.error}`);
  }

  // Create message in database
  const { success, id, status, error_message } = await createMessage({
    ...mediaResult.mediaData,
    is_channel_post: isChannelPost,
    correlation_id: correlationId,
    telegram_message_id: message.message_id,
    chat_id: message.chat.id,
    file_unique_id: message.photo
      ? message.photo[message.photo.length - 1].file_unique_id
      : message.video?.file_unique_id || message.document?.file_unique_id
  }, logger);

  if (!success || !id) {
    throw new Error(error_message || "Failed to create message record");
  }

  logger?.success(`Successfully processed new media message. DB ID: ${id}`);

  // Log event
  const eventType = status === 'new' ? "message_created" : "message_duplicate_handled";
  await logEvent(
    eventType,
    id,
    correlationId,
    {
      rpc_status: status,
      message_id: message.message_id,
      chat_id: message.chat.id
    }
  );

  return {
    success: true,
    id,
    status,
    action: status === 'new' ? 'created' : 'updated',
    needsProcessing: status === 'new'
  };
}
