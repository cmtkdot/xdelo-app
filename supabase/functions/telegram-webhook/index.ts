
/**
 * Main entry point for the Telegram webhook
 */
import { serve } from "https://deno.land/std@0.217.0/http/server.ts";
import { createHandler, SecurityLevel, RequestMetadata } from "../_shared/unifiedHandler.ts";
import { isMessageForwarded } from "./utils/messageUtils.ts";
import { logEvent, logErrorEvent } from "./services/loggingService.ts";
import { checkExistingMessage } from "./services/databaseService.ts";
import { handleEditedMessage, handleMediaMessage, handleOtherMessage } from "./handlers/index.ts";
import { createTelegramErrorResponse } from "./services/responseService.ts";
import { Logger } from "./utils/logger.ts";

// Define the core handler logic
const webhookHandler = async (req: Request, metadata: RequestMetadata) => {
  // Create a logger using the correlation ID from metadata
  const logger = new Logger(metadata.correlationId, "telegram-webhook");

  try {
    // Log webhook received event
    logger.info("Webhook received", {
      method: metadata.method,
      path: metadata.path,
    });

    await logEvent(
      "webhook_received",
      "system",
      metadata.correlationId,
      {
        source: "telegram-webhook",
        timestamp: new Date().toISOString(),
      }
    );

    // Parse the update from Telegram
    let update;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      update = await req.json();
      clearTimeout(timeoutId);

      logger.info("Received Telegram update", {
        update_id: update.update_id,
        update_type: Object.keys(update)
          .filter((k) => k !== "update_id")
          .join(", "),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      logger.error("Failed to parse request body", { error: errorMessage });
      
      throw new Error(errorName === "AbortError" 
        ? "Request timeout parsing JSON" 
        : `Invalid JSON in request body: ${errorMessage}`);
    }

    // Get the message object
    const message =
      update.message ||
      update.edited_message ||
      update.channel_post ||
      update.edited_channel_post;
      
    if (!message) {
      logger.warn("No processable content in update", {
        update_keys: Object.keys(update),
      });
      throw new Error("No processable content in update");
    }

    // --- Check Retry Limit ---
    const MAX_RETRIES = 3;
    
    // Check if message already exists and has reached retry limit
    const { exists, id: existingId, retryCount } = await checkExistingMessage(
      message.message_id,
      message.chat?.id
    );

    if (exists && (retryCount || 0) >= MAX_RETRIES) {
      logger.warn(`Max retries (${MAX_RETRIES}) reached for message ${message.message_id}. Skipping processing.`, {
        message_id: message.message_id,
        chat_id: message.chat?.id,
        retry_count: retryCount,
      });
      
      await logEvent(
        "max_retries_reached",
        existingId || message.message_id.toString(),
        metadata.correlationId,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          retry_count: retryCount,
        }
      );
      
      // Return 200 OK to Telegram to stop further retries
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Max retries reached, skipping.", 
          correlationId: metadata.correlationId 
        }), 
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    // --- End Retry Limit Check ---

    // Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: isMessageForwarded(message),
      correlationId: metadata.correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post,
      logger,
      startTime: new Date().toISOString(),
      metadata
    };

    // Log message details
    logger.info("Processing message", {
      message_id: message.message_id,
      chat_id: message.chat?.id,
    });

    // Handle different message types
    try {
      // Determine if the message (new or edited) contains media
      const hasMedia = !!(message.photo || message.video || message.document);

      let response;
      
      if (context.isEdit) {
        // Handle edited messages
        if (hasMedia) {
          // Edited message WITH media -> media handler
          logger.info("Routing edited message with media to media message handler");
          response = await handleMediaMessage(message, context);
        } else {
          // Edited message WITHOUT media -> generic edit handler
          logger.info("Routing edited message without media to edited message handler");
          response = await handleEditedMessage(message, context);
        }
      } else {
        // Handle new messages
        if (hasMedia) {
          // New message WITH media -> media handler
          logger.info("Routing new media message to media message handler");
          response = await handleMediaMessage(message, context);
        } else {
          // New message WITHOUT media -> text handler
          logger.info("Routing new text message to text message handler");
          response = await handleOtherMessage(message, context);
        }
      }

      logger.info("Successfully processed message", {
        message_id: message.message_id,
        processing_time: new Date().getTime() - new Date(context.startTime).getTime(),
      });

      // Return the raw response
      return response;
    } catch (handlerError) {
      const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
      const handlerErrorStack = handlerError instanceof Error ? handlerError.stack : undefined;
      
      logger.error("Error in message handler", {
        error: handlerErrorMessage,
        stack: handlerErrorStack,
        message_id: message.message_id,
      });

      // Log the error to the database
      await logErrorEvent(
        "message_processing_failed",
        message.message_id.toString(),
        metadata.correlationId,
        handlerError,
        {
          message_id: message.message_id,
          chat_id: message.chat?.id,
          handler_type: "message_handler"
        }
      );

      // Return Telegram compatible error response (status 200)
      return createTelegramErrorResponse(handlerError, metadata.correlationId);
    }
  } catch (error) {
    const initialErrorMessage = error instanceof Error ? error.message : String(error);
    const initialErrorStack = error instanceof Error ? error.stack : undefined;
    
    // Log any unexpected errors during initial processing
    logger.error("Unhandled error during initial webhook processing", {
      error: initialErrorMessage,
      stack: initialErrorStack,
    });
    
    // Re-throw for the unified handler to catch and format
    throw error;
  }
};

// Create the handler instance using the builder
const handler = createHandler(webhookHandler)
  .withMethods(['POST'])
  .withSecurity(SecurityLevel.PUBLIC)
  .withLogging(true)
  .withMetrics(true);

// Serve the built handler
serve(handler.build());
