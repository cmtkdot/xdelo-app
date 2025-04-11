/**
 * Error handling utilities for the Telegram webhook
 */
import { corsHeaders } from "../../_shared/cors.ts";
/**
 * Create a standardized error response for the Telegram webhook
 * 
 * @param message - The error message
 * @param functionName - The name of the function where the error occurred
 * @param status - The HTTP status code (default: 500)
 * @param correlationId - The correlation ID for request tracking
 * @param metadata - Additional metadata to include in the response
 * @returns A Response object with the error details
 */
export function createErrorResponse(
  message: string,
  functionName: string,
  status = 500,
  correlationId: string,
  metadata?: Record<string, any>
): Response {
  console.error(`[${correlationId}][${functionName}] Error: ${message}`);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      correlationId,
      function: functionName,
      timestamp: new Date().toISOString(),
      ...metadata
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * Create a handleError function using the shared formatErrorDetail
 */
export function formatErrorDetail(error: unknown, context?: Record<string, any>): ErrorDetail {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context
    };
  } else {
    return {
      name: 'UnknownError',
      message: String(error),
      context
    };
  }
}
