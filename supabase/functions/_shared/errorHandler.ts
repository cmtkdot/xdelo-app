// Standard error handler for Edge Functions
import { corsHeaders } from "./cors.ts";
import { createSupabaseClient } from "./cors.ts";

export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated",
  SERVICE_ROLE = "service_role"
}

export interface ErrorHandlerOptions {
  securityLevel: SecurityLevel;
  fallbackToPublic?: boolean;
  bypassForServiceRole?: boolean;
  logToDatabase?: boolean;
}

export interface ErrorDetail {
  messageId?: string;
  errorMessage: string;
  correlationId?: string;
  functionName: string;
  metadata?: Record<string, any>;
  errorType?: string;
  errorStack?: string;
}

/**
 * Log an error to the database for auditing
 */
export async function logErrorToDatabase(error: ErrorDetail): Promise<string | null> {
  const supabaseClient = createSupabaseClient();
  const correlationId = error.correlationId || crypto.randomUUID();
  
  try {
    const { data, error: dbError } = await supabaseClient
      .from("unified_audit_logs")
      .insert({
        event_type: "edge_function_error",
        entity_id: error.messageId || "unknown",
        metadata: {
          function_name: error.functionName,
          error_time: new Date().toISOString(),
          error_type: error.errorType,
          ...error.metadata
        },
        error_message: error.errorMessage,
        correlation_id: correlationId
      })
      .select('id')
      .single();
      
    if (dbError) {
      console.error("Failed to log error to database:", dbError);
      return null;
    }
    
    return data?.id || correlationId;
  } catch (e) {
    console.error("Exception logging error to database:", e);
    return null;
  }
}

/**
 * Update a message record with error information
 */
export async function updateMessageWithError(
  messageId: string, 
  errorMessage: string, 
  correlationId?: string,
  errorType?: string
): Promise<boolean> {
  if (!messageId) return false;
  
  const supabaseClient = createSupabaseClient();
  
  try {
    const { error: updateError } = await supabaseClient
      .from("messages")
      .update({
        processing_state: "error",
        error_message: errorMessage,
        error_type: errorType,
        last_error_at: new Date().toISOString(),
        correlation_id: correlationId
      })
      .eq("id", messageId);
      
    if (updateError) {
      console.error("Failed to update message with error:", updateError);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error("Exception updating message with error:", e);
    return false;
  }
}

/**
 * Create a standardized error response
 */
export function handleError(
  error: Error | string, 
  functionName: string,
  status = 500, 
  correlationId?: string,
  metadata?: Record<string, any>
): Response {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'string' ? 'Error' : error.name;
  const errorStack = typeof error === 'string' ? undefined : error.stack;
  const cid = correlationId || crypto.randomUUID();
  
  console.error(`[${functionName}] [${cid}] Error:`, errorMessage, errorStack ? '\n' + errorStack : '');
  
  return new Response(
    JSON.stringify({
      error: errorMessage,
      errorType,
      success: false,
      correlationId: cid,
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
 * Wrap an Edge Function handler with standardized error handling
 */
export function withErrorHandling(
  functionName: string,
  handler: (req: Request, correlationId: string) => Promise<Response>,
  options: Partial<ErrorHandlerOptions> = {}
): (req: Request) => Promise<Response> {
  const config: ErrorHandlerOptions = {
    securityLevel: SecurityLevel.PUBLIC,
    fallbackToPublic: true,
    bypassForServiceRole: true,
    logToDatabase: true,
    ...options
  };
  
  return async (req: Request): Promise<Response> => {
    // Generate a correlation ID for request tracking
    const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
    
    try {
      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }
      
      // Log the start of the request
      console.log(`[${functionName}] Request started with correlation ID: ${correlationId}`);
      
      // Clone the request to add the correlation ID
      const enhancedRequest = new Request(req.url, {
        method: req.method,
        headers: new Headers([...Array.from(req.headers.entries()), ['x-correlation-id', correlationId]]),
        body: req.body,
        redirect: req.redirect
      });
      
      // Time the request execution
      const startTime = performance.now();
      const response = await handler(enhancedRequest, correlationId);
      const duration = performance.now() - startTime;
      
      // Add correlation ID and execution time to response headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers([
          ...Array.from(response.headers.entries()),
          ['x-correlation-id', correlationId],
          ['x-execution-time', `${duration.toFixed(2)}ms`]
        ])
      });
      
      // Log request completion
      console.log(`[${functionName}] Request completed in ${duration.toFixed(2)}ms`);
      
      return enhancedResponse;
      
    } catch (error) {
      // Log the error
      console.error(`[${functionName}] Error with correlation ID ${correlationId}:`, error);
      
      // Log to database if enabled
      if (config.logToDatabase) {
        await logErrorToDatabase({
          functionName,
          errorMessage: error instanceof Error ? error.message : String(error),
          correlationId,
          errorType: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined
        });
      }
      
      return handleError(
        error instanceof Error ? error : new Error(String(error)), 
        functionName,
        500,
        correlationId
      );
    }
  };
}
