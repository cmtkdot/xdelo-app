/**
 * errorUtils.ts
 * 
 * Specialized error handling utilities for Telegram webhook handlers.
 * Builds on the core ErrorHandler.ts functionality to provide context-specific
 * error handling for Telegram message processing.
 */ // Local error handler utilities
import { createErrorResponse as localErrorResponse } from "./errorHandler.ts";
import { RetryHandler, createRetryHandler } from "../../_shared/retryHandler.ts";
/**
 * Handle an error in a Telegram webhook handler with comprehensive logging and database updates
 * 
 * @param error - The error that occurred
 * @param context - The context in which the error occurred
 * @returns A result object indicating what actions were taken
 * @example
 * try {
 *   // Process message
 * } catch (error) {
 *   const result = await handleTelegramError(error, {
 *     message,
 *     supabaseClient,
 *     correlationId,
 *     functionName: 'handleMediaMessage',
 *     messageId: dbMessageId
 *   });
 *   
 *   return handleError(
 *     error, 
 *     'handleMediaMessage', 
 *     500, 
 *     result.correlationId
 *   );
 * }
 */ export async function handleTelegramError(error, context) {
  const { message, supabaseClient, correlationId, functionName, messageId, metadata = {} } = context;
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'string' ? 'Error' : error.name;
  const errorStack = typeof error === 'string' ? undefined : error.stack;
  const cid = correlationId || crypto.randomUUID();
  // Log to console with detailed context
  console.error(`[${functionName}] [${cid}] Error processing message ${message.message_id} in chat ${message.chat.id}:`, errorMessage, errorStack ? '\n' + errorStack : '');
  // Prepare error details for database logging
  const errorDetail = {
    messageId,
    errorMessage,
    correlationId: cid,
    functionName,
    errorType,
    errorStack,
    metadata: {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      message_date: new Date(message.date * 1000).toISOString(),
      ...metadata
    }
  };
  // Log error to database - implement our own version since we can't use the shared one
  let auditLogId = null;
  try {
    // Insert error into unified_audit_logs table
    const { data, error } = await supabaseClient.from('unified_audit_logs').insert({
      correlation_id: cid,
      event_type: 'error',
      event_timestamp: new Date().toISOString(),
      error_message: errorMessage,
      event_message: errorMessage,
      metadata: {
        error_type: errorType,
        error_stack: errorStack,
        function_name: functionName,
        ...errorDetail.metadata
      },
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      message_type: 'telegram'
    }).select('id').single();
    if (error) {
      console.error(`[${cid}][${functionName}] Failed to log error to database:`, error.message);
    } else if (data) {
      auditLogId = data.id;
    }
  } catch (dbError) {
    console.error(`[${cid}][${functionName}] Exception logging error to database:`, dbError instanceof Error ? dbError.message : String(dbError));
  }
  // Update message record if we have a message ID
  let messageUpdated = false;
  if (messageId) {
    try {
      // Update message with error information
      const { error } = await supabaseClient.from('messages').update({
        processing_state: 'error',
        processing_error: errorMessage,
        correlation_id: cid,
        error_type: errorType,
        updated_at: new Date().toISOString()
      }).eq('id', messageId);
      if (error) {
        console.error(`[${cid}][${functionName}] Failed to update message with error:`, error.message);
      } else {
        messageUpdated = true;
      }
    } catch (dbError) {
      console.error(`[${cid}][${functionName}] Exception updating message with error:`, dbError instanceof Error ? dbError.message : String(dbError));
    }
  }
  return {
    handled: true,
    correlationId: cid,
    auditLogId: auditLogId || undefined,
    messageUpdated
  };
}
/**
 * Create a standardized error response for Telegram webhook handlers
 * 
 * @param error - The error that occurred
 * @param functionName - The name of the function where the error occurred
 * @param status - The HTTP status code to return (default: 500)
 * @param correlationId - The correlation ID for request tracking
 * @param metadata - Additional metadata to include in the response
 * @returns A Response object with standardized error information
 * @example
 * try {
 *   // Process message
 * } catch (error) {
 *   return createTelegramErrorResponse(
 *     error,
 *     'handleMediaMessage',
 *     500,
 *     correlationId,
 *     { messageId: message.message_id }
 *   );
 * }
 */ export function createTelegramErrorResponse(error, functionName, status = 500, correlationId, metadata) {
  // Use the local error response function instead of the shared one that was removed
  const errorMessage = error instanceof Error ? error.message : error;
  const cid = correlationId || crypto.randomUUID();
  // Log the error to console
  console.error(`[${functionName}] [${cid}] Error: ${errorMessage}`);
  // Use localErrorResponse from errorHandler.ts instead of handleError
  return localErrorResponse(errorMessage, functionName, status, cid, {
    source: 'telegram-webhook',
    ...metadata
  });
}
/**
 * Retry a function with exponential backoff
 * 
 * @deprecated Use the centralized RetryHandler from _shared/retryHandler.ts instead
 * @param operation - The function to retry
 * @param options - Retry options
 * @returns The result of the operation
 * @example
 * // Old way (deprecated):
 * const result = await retryWithBackoff(
 *   async () => await processCaption(message.caption),
 *   {
 *     maxRetries: 3,
 *     initialDelayMs: 100,
 *     functionName: 'processCaption',
 *     correlationId
 *   }
 * );
 * 
 * // New way (preferred):
 * const retryHandler = createRetryHandler({ maxRetries: 3, initialDelayMs: 100 });
 * const result = await retryHandler.execute(
 *   async () => await processCaption(message.caption),
 *   {
 *     operationName: 'processCaption',
 *     correlationId
 *   }
 * );
 */ export async function retryWithBackoff(operation, options) {
  console.warn(`[${options.correlationId}][${options.functionName}] WARNING: Using deprecated retryWithBackoff. ` + 'Please migrate to the centralized RetryHandler from _shared/retryHandler.ts');
  // Use the shared RetryHandler under the hood to maintain consistency
  const retryHandler = createRetryHandler({
    maxRetries: options.maxRetries || 3,
    initialDelayMs: options.initialDelayMs || 100,
    backoffFactor: options.backoffFactor || 2,
    useJitter: true
  });
  const result = await retryHandler.execute(operation, {
    operationName: options.functionName,
    correlationId: options.correlationId,
    supabaseClient: null,
    contextData: {
      source: 'legacy_retryWithBackoff'
    }
  });
  if (result.success && result.result !== undefined) {
    return result.result;
  } else {
    // If result.error is already an Error object, throw it directly
    // Otherwise, create a new Error with the string message
    if (result.error instanceof Error) {
      throw result.error;
    } else {
      throw new Error(String(result.error) || 'Operation failed without a specific error message');
    }
  }
}
// Re-export RetryHandler and related types for convenience
export { RetryHandler, createRetryHandler };
/**
 * Wrap a function with error handling for Telegram webhook handlers
 * 
 * @param functionName - The name of the function to wrap
 * @param handler - The function to wrap
 * @returns A wrapped function with error handling
 * @example
 * const safeProcessMedia = withTelegramErrorHandling(
 *   'processMedia',
 *   async (message, supabaseClient, correlationId) => {
 *     // Process media
 *     return result;
 *   }
 * );
 * 
 * // Then use it
 * const result = await safeProcessMedia(message, supabaseClient, correlationId);
 */ export function withTelegramErrorHandling(functionName, handler) {
  return async (...args)=>{
    try {
      return await handler(...args);
    } catch (error) {
      // Try to extract context from arguments
      // This assumes certain argument positions, which may need adjustment
      const context = {
        functionName
      };
      // Try to extract message, supabaseClient, and correlationId from args
      for (const arg of args){
        if (arg && typeof arg === 'object') {
          if (arg.message_id && arg.chat) {
            context.message = arg;
          } else if (arg.from && typeof arg.from === 'function') {
            context.supabaseClient = arg;
          }
        } else if (typeof arg === 'string' && arg.length > 8) {
          context.correlationId = arg;
        }
      }
      // Log what we can
      console.error(`[${functionName}] Error:`, error instanceof Error ? error.message : String(error), error instanceof Error && error.stack ? '\n' + error.stack : '');
      // Re-throw the error
      throw error;
    }
  };
}
