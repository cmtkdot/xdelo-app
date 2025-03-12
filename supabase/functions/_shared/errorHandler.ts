
// Standard error handler for Edge Functions
import { corsHeaders } from "./cors.ts";

export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated",
  SERVICE_ROLE = "service_role"
}

export interface ErrorHandlerOptions {
  securityLevel: SecurityLevel;
  fallbackToPublic?: boolean;
  bypassForServiceRole?: boolean;
}

export interface ErrorDetail {
  messageId?: string;
  errorMessage: string;
  correlationId?: string;
  functionName: string;
}

export async function logErrorToDatabase(supabaseClient: any, error: ErrorDetail) {
  try {
    await supabaseClient.from("unified_audit_logs").insert({
      event_type: "edge_function_error",
      entity_id: error.messageId || "unknown",
      error_message: error.errorMessage,
      correlation_id: error.correlationId || crypto.randomUUID(),
      metadata: {
        function_name: error.functionName,
        error_time: new Date().toISOString()
      }
    });
  } catch (e) {
    console.error("Failed to log error to database:", e);
  }
}

export async function updateMessageWithError(
  supabaseClient: any, 
  messageId: string, 
  errorMessage: string, 
  correlationId?: string
) {
  if (!messageId) return;
  
  try {
    await supabaseClient
      .from("messages")
      .update({
        processing_state: "error",
        error_message: errorMessage,
        last_error_at: new Date().toISOString()
      })
      .eq("id", messageId);
  } catch (e) {
    console.error("Failed to update message with error:", e);
  }
}

export function handleError(error: Error, message = "An error occurred", status = 500) {
  console.error(`${message}:`, error);
  
  return new Response(
    JSON.stringify({
      error: error.message || message,
      success: false
    }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

export function withErrorHandling(
  functionName: string,
  handler: (req: Request, correlationId: string) => Promise<Response>,
  options: ErrorHandlerOptions = { securityLevel: SecurityLevel.PUBLIC }
) {
  return async (req: Request): Promise<Response> => {
    // Generate a correlation ID for request tracking
    const correlationId = crypto.randomUUID();
    
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
      
      // Log the start of the request
      console.log(`[${functionName}] Request started with correlation ID: ${correlationId}`);
      
      // Time the request execution
      const startTime = performance.now();
      const response = await handler(req, correlationId);
      const duration = performance.now() - startTime;
      
      // Log request completion
      console.log(`[${functionName}] Request completed in ${duration.toFixed(2)}ms`);
      
      return response;
    } catch (error) {
      // Log the error
      console.error(`[${functionName}] Error with correlation ID ${correlationId}:`, error);
      
      return handleError(
        error instanceof Error ? error : new Error(String(error)), 
        `Error in ${functionName}`,
        500
      );
    }
  };
}
