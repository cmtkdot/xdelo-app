
/**
 * Service for generating standardized responses
 */
import { corsHeaders } from "../../_shared/cors.ts";

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(error: unknown, correlationId: string, status = 500): Response {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      correlationId,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    }
  );
}

/**
 * Creates a Telegram webhook compatible error response
 * Always returns status 200 to prevent Telegram from retrying
 */
export function createTelegramErrorResponse(error: unknown, correlationId: string): Response {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      correlationId,
    }),
    {
      // Always return 200 OK to Telegram to prevent retries
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
}
