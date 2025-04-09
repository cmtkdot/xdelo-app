/**
 * Error handling utilities for the Telegram webhook
 */
import { corsHeaders } from "../../_shared/cors.ts";
import { handleError as sharedHandleError } from "../../_shared/ErrorHandler.ts";

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
 * Re-export the shared handleError function for convenience
 */
export { sharedHandleError as handleError };
