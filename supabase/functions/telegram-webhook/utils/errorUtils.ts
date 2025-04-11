/**
 * errorUtils.ts
 * 
 * Specialized error handling utilities for Telegram webhook handlers.
 * Builds on the core ErrorHandler.ts functionality to provide context-specific
 * error handling for Telegram message processing.
 */

import { 
  handleError, 
  logErrorToDatabase, 
  updateMessageWithError,
  ErrorDetail
} from "../../_shared/ErrorHandler.ts";
import { TelegramMessage } from "../types.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { RetryHandler, createRetryHandler, RetryOptions, RetryExecuteOptions, RetryResult } from "../../_shared/retryHandler.ts";

/**
 * Context for Telegram message error handling
 */
export interface TelegramErrorContext {
  /** The Telegram message being processed */
  message: TelegramMessage;
  /** The Supabase client for database operations */
  supabaseClient: SupabaseClient;
  /** The correlation ID for request tracking */
  correlationId: string;
  /** The name of the function where the error occurred */
  functionName: string;
  /** The database message ID if available */
  messageId?: string;
  /** Additional metadata to include in error logs */
  metadata?: Record<string, any>;
}

/**
 * Result of an error handling operation
 */
export interface ErrorHandlingResult {
  /** Whether the error was successfully handled */
  handled: boolean;
  /** The correlation ID associated with the error */
  correlationId: string;
  /** The audit log ID if the error was logged to the database */
  auditLogId?: string;
  /** Whether the message was updated with error information */
  messageUpdated: boolean;
}

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
 */
export async function handleTelegramError(
  error: Error | string,
  context: TelegramErrorContext
): Promise<ErrorHandlingResult> {
  const { 
    message, 
    supabaseClient, 
    correlationId, 
    functionName, 
    messageId, 
    metadata = {} 
  } = context;
  
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'string' ? 'Error' : error.name;
  const errorStack = typeof error === 'string' ? undefined : error.stack;
  const cid = correlationId || crypto.randomUUID();
  
  // Log to console with detailed context
  console.error(
    `[${functionName}] [${cid}] Error processing message ${message.message_id} in chat ${message.chat.id}:`,
    errorMessage,
    errorStack ? '\n' + errorStack : ''
  );
  
  // Prepare error details for database logging
  const errorDetail: ErrorDetail = {
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
  
  // Log to database
  const auditLogId = await logErrorToDatabase(errorDetail);
  
  // Update message record if we have a message ID
  let messageUpdated = false;
  if (messageId) {
    messageUpdated = await updateMessageWithError(
      messageId,
      errorMessage,
      cid,
      errorType
    );
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
 */
export function createTelegramErrorResponse(
  error: Error | string,
  functionName: string,
  status = 500,
  correlationId?: string,
  metadata?: Record<string, any>
): Response {
  return handleError(
    error,
    functionName,
    status,
    correlationId,
    {
      source: 'telegram-webhook',
      ...metadata
    }
  );
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
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
    functionName: string;
    correlationId: string;
  }
): Promise<T> {
  console.warn(
    `[${options.correlationId}][${options.functionName}] WARNING: Using deprecated retryWithBackoff. ` +
    'Please migrate to the centralized RetryHandler from _shared/retryHandler.ts'
  );
  
  // Use the shared RetryHandler under the hood to maintain consistency
  const retryHandler = createRetryHandler({
    maxRetries: options.maxRetries || 3,
    initialDelayMs: options.initialDelayMs || 100,
    backoffFactor: options.backoffFactor || 2,
    useJitter: true
  });
  
  const result = await retryHandler.execute(
    operation,
    {
      operationName: options.functionName,
      correlationId: options.correlationId,
      contextData: { source: 'legacy_retryWithBackoff' }
    }
  );
  
  if (result.success) {
    return result.result;
  } else {
    throw result.error;
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
 */
export function withTelegramErrorHandling<T, Args extends any[]>(
  functionName: string,
  handler: (...args: Args) => Promise<T>
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Try to extract context from arguments
      // This assumes certain argument positions, which may need adjustment
      let context: Partial<TelegramErrorContext> = {
        functionName
      };
      
      // Try to extract message, supabaseClient, and correlationId from args
      for (const arg of args) {
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
      console.error(
        `[${functionName}] Error:`,
        error instanceof Error ? error.message : String(error),
        error instanceof Error && error.stack ? '\n' + error.stack : ''
      );
      
      // Re-throw the error
      throw error;
    }
  };
}
