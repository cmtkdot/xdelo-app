
/**
 * Handler for non-media messages
 */
import { MessageContext, TelegramMessage } from "../types.ts";
import { buildTelegramMessageUrl } from "../utils/urlBuilder.ts";
import { isMessageForwarded } from "../utils/messageUtils.ts";
import { createMessage } from "../services/databaseService.ts";
import { createSuccessResponse, createTelegramErrorResponse } from "../services/responseService.ts";
import { logEvent, logErrorEvent } from "../services/loggingService.ts";

/**
 * Handler for text/other messages
 */
export async function handleOtherMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  try {
    const { isChannelPost, correlationId, logger } = context;
    const isForwarded = isMessageForwarded(message);

    logger?.info(
      `📝 Processing non-media message ${message.message_id} in chat ${message.chat.id}`,
      {
        message_text: message.text
          ? `${message.text.substring(0, 50)}${
              message.text.length > 50 ? "..." : ""
            }`
          : null,
        message_type: isChannelPost ? "channel_post" : "message",
        is_forwarded: isForwarded,
      }
    );

    // Generate message URL
    const message_url = buildTelegramMessageUrl(message.chat.id, message.message_id);

    // Create message record
    const {
      id: messageId,
      success,
      error_message,
    } = await createMessage(
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_type: isChannelPost ? "channel_post" : "message",
        text: message.text || "",
        telegram_data: message,
        processing_state: "pending", 
        is_forward: isForwarded,
        correlation_id: correlationId,
        message_url: message_url,
      },
      logger
    );

    if (!success || !messageId) {
      logger?.error(`❌ Failed to store text message in database`, { error: error_message });
      throw new Error(error_message || "Failed to create message record");
    }

    // Log successful processing
    await logEvent(
      "message_created",
      messageId,
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: "text",
        is_forward: isForwarded,
        message_url: message_url,
      }
    );

    logger?.success(
      `✅ Successfully processed text message ${message.message_id}`,
      {
        message_id: message.message_id,
        db_id: messageId,
        message_url: message_url,
      }
    );

    return createSuccessResponse({
      success: true,
      messageId,
      correlationId,
      message_url: message_url,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    context.logger?.error(`❌ Error processing non-media message: ${errorMessage}`, {
      error: errorMessage,
      stack: errorStack,
      message_id: message.message_id,
    });

    // Log the error
    try {
      await logErrorEvent(
        "message_processing_error",
        "system",
        context.correlationId,
        error,
        {
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          handler_type: "other_message",
        }
      );
    } catch (logError) {
      console.error(`Failed to log processing error to database: ${logError instanceof Error ? logError.message : String(logError)}`);
    }

    // Return Telegram compatible error response (status 200)
    return createTelegramErrorResponse(error, context.correlationId);
  }
}
