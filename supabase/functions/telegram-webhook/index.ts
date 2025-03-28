import { serve } from "https://deno.land/std@0.217.0/http/server.ts"; // Use versioned import
import { createHandler, SecurityLevel, RequestMetadata } from "../_shared/unifiedHandler.ts"; // Import unified handler
import { isMessageForwarded } from "../_shared/consolidatedMessageUtils.ts"; // Only need isMessageForwarded
import { logProcessingEvent } from "../_shared/auditLogger.ts"; // Import from dedicated module
// Remove redundant import: import { xdelo_logProcessingEvent } from "../_shared/databaseOperations.ts";
import { handleEditedMessage } from "./handlers/editedMessageHandler.ts";
import { handleMediaMessage } from "./handlers/mediaMessageHandler.ts";
import { handleOtherMessage } from "./handlers/textMessageHandler.ts";
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

    await logProcessingEvent( // Use the imported logProcessingEvent
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
    } catch (error: unknown) { // Add type annotation
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "UnknownError";
      logger.error("Failed to parse request body", { error: errorMessage });
      // Let the unified handler manage the error response creation
      throw new Error(errorName === "AbortError" ? "Request timeout parsing JSON" : `Invalid JSON in request body: ${errorMessage}`);
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
      // Let the unified handler manage the error response creation
      throw new Error("No processable content in update");
    }

    // Determine message context using metadata
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: isMessageForwarded(message),
      correlationId: metadata.correlationId, // Use correlationId from metadata
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post,
      logger,
      startTime: new Date().toISOString(), // Keep startTime for internal duration tracking if needed
      metadata // Pass full metadata if sub-handlers need it
    };

    // Log message details
    logger.info("Processing message", {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      // ... (other logging details)
    });

    // Handle different message types
    let response;
    try {
      if (context.isEdit) {
        logger.info("Routing to edited message handler");
        response = await handleEditedMessage(message, context);
      } else if (message.photo || message.video || message.document) {
        logger.info("Routing to media message handler");
        response = await handleMediaMessage(message, context);
      } else {
        logger.info("Routing to text message handler");
        response = await handleOtherMessage(message, context);
      }

      logger.info("Successfully processed message", {
        message_id: message.message_id,
        processing_time: new Date().getTime() - new Date(context.startTime).getTime(),
      });

      // Return the raw response; unified handler will add headers
      return response;

    } catch (handlerError: unknown) { // Add type annotation
      const handlerErrorMessage = handlerError instanceof Error ? handlerError.message : String(handlerError);
      const handlerErrorStack = handlerError instanceof Error ? handlerError.stack : undefined;
      logger.error("Error in message handler", {
        error: handlerErrorMessage,
        stack: handlerErrorStack,
        message_id: message.message_id,
      });

      // Log the error to the database
      await logProcessingEvent( // Use the imported logProcessingEvent
        "message_processing_failed",
        message.message_id.toString(),
        metadata.correlationId,
        { /* ... error metadata ... */ },
        handlerErrorMessage || "Unknown handler error"
      );

      // IMPORTANT: Re-throw the error so the unified handler can catch it and return the standard error response.
      // However, Telegram requires a 200 OK even on errors to prevent retries.
      // We need a way to signal this specific case to the unified handler.
      // For now, let's return a specific error type or status that the unified handler can interpret.
      // Or, modify the unified handler to allow overriding the status code for specific errors.

      // Temporary solution: Return a successful response with error details
      // This acknowledges receipt to Telegram but indicates processing failure.
      return new Response(
        JSON.stringify({
          success: false,
          error: handlerErrorMessage, // Use extracted message
          correlationId: metadata.correlationId,
        }),
        {
          // Return 200 OK to Telegram
          status: 200,
          headers: { 'Content-Type': 'application/json' } // Basic headers, unified handler adds CORS
        }
      );
      // Ideally, modify unifiedHandler to handle this specific 200-on-error case.
      // throw handlerError; // Re-throwing would cause a 500 error response
    }
  } catch (error: unknown) { // Add type annotation
    const initialErrorMessage = error instanceof Error ? error.message : String(error);
    const initialErrorStack = error instanceof Error ? error.stack : undefined;
    // Log any unexpected errors during initial processing (e.g., JSON parsing)
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
  .withMethods(['POST']) // Only allow POST requests
  .withSecurity(SecurityLevel.PUBLIC) // Webhook is public
  .withLogging(true) // Enable logging via the handler
  .withMetrics(true); // Enable metrics

// Serve the built handler
serve(handler.build());
