import {
  constructTelegramMessageUrl,
  isMessageForwarded,
  // logProcessingEvent removed, imported from auditLogger below
} from "../../_shared/consolidatedMessageUtils.ts";
import { logProcessingEvent } from "../../_shared/auditLogger.ts"; // Import the correct 5-argument function
import { corsHeaders } from "../../_shared/cors.ts";
import {
  createMessage,
} from "../dbOperations.ts";
import { MessageContext, TelegramMessage } from "../types.ts";

export async function handleOtherMessage(
  message: TelegramMessage,
  context: MessageContext
): Promise<Response> {
  try {
    const { isChannelPost, correlationId, logger } = context;
    // Use the utility function to determine if message is forwarded
    const isForwarded = isMessageForwarded(message);

    // Log the start of message processing
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

    // Generate message URL using consolidated utility function
    const message_url = constructTelegramMessageUrl(
      message.chat.id,
      message.message_id
    );

    // Create message record with optimized operation - using the unified createMessage function
    // to avoid the issue with telegram_metadata column
    const {
      id: messageId,
      success,
      error_message,
    } = await createMessage( // Remove supabaseClient argument
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        message_type: isChannelPost ? "channel_post" : "message",
        text: message.text || "",
        telegram_data: message,
        processing_state: "pending", // Assuming text messages might need processing later
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

    // Text message saved. Caption processing is handled separately by the
    // database trigger 'trg_process_caption' if the 'caption' field is set
    // (which it isn't for these messages handled here).
    // If text analysis is needed, a different mechanism should be implemented.

    // Log successful processing using the 5-argument logProcessingEvent
    await logProcessingEvent(
      "message_created", // eventType
      messageId, // entityId
      correlationId, // correlationId
      { // metadata
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: "text",
        is_forward: isForwarded,
        message_url: message_url,
      },
      undefined // errorMessage
    );

    logger?.success(
      `✅ Successfully processed text message ${message.message_id}`,
      {
        message_id: message.message_id,
        db_id: messageId,
        message_url: message_url,
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        correlationId,
        message_url: message_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) { // Added type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    context.logger?.error(`❌ Error processing non-media message: ${errorMessage}`, {
      error: errorMessage, // Log the message string
      stack: errorStack,
      message_id: message.message_id,
    });

    // Log the error to the database using the 5-argument logProcessingEvent
    try {
      await logProcessingEvent(
        "message_processing_error", // eventType
        "system", // entityId
        context.correlationId, // correlationId
        { // metadata
            telegram_message_id: message.message_id,
            chat_id: message.chat.id,
            handler_type: "other_message",
            error: errorMessage, // Include error in metadata
            stack: errorStack,
        },
        errorMessage // errorMessage
      );
    } catch (logError: unknown) {
      const logErrorMessage = logError instanceof Error ? logError.message : String(logError);
      console.error(`Failed to log processing error to database: ${logErrorMessage}`);
    }


    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage || "Unknown error processing message",
        correlationId: context.correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}
