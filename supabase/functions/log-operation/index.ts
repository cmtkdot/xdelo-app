
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logProcessingEvent, logErrorEvent } from "../_shared/auditLogger.ts";
import { RetryHandler, shouldRetryOperation } from "../_shared/retryUtils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LogOperationRequest {
  eventType: string;
  entityId: string;
  metadata?: Record<string, any>;
  retryOptions?: {
    maxAttempts?: number;
    ignoreErrors?: boolean;
  };
}

/**
 * Handler for logging operations to the unified audit system
 */
const handler = async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a correlation ID for this request
  const correlationId = crypto.randomUUID().toString();
  let eventType = "unknown";
  let entityId = "system";

  try {
    // Parse the request body
    const requestBody = await req.json();
    const { eventType: reqEventType, entityId: reqEntityId, metadata = {}, retryOptions = {} } = requestBody as LogOperationRequest;
    
    // Update tracking variables for potential error logging
    eventType = reqEventType || eventType;
    entityId = reqEntityId || entityId;

    // Validate required parameters
    if (!eventType || !entityId) {
      console.warn(`[log-operation] Missing required parameters: eventType=${eventType}, entityId=${entityId}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters (eventType, entityId)",
          correlationId,
          code: "INVALID_PARAMETERS"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Set up retry handler with custom options if provided
    const retryHandler = new RetryHandler({
      maxAttempts: retryOptions.maxAttempts || 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000
    });

    // Execute the log operation with retries
    await retryHandler.execute(
      async () => {
        await logProcessingEvent(
          eventType,
          entityId,
          correlationId,
          {
            ...metadata,
            source: "log-operation",
            timestamp: new Date().toISOString(),
          }
        );
      },
      shouldRetryOperation
    );

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Operation ${eventType} logged successfully`,
        entityId,
        correlationId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error(`[log-operation] Error processing request:`, error);
    
    // Log the error to the audit system
    try {
      await logErrorEvent(
        "log_operation_error",
        entityId,
        correlationId,
        error,
        {
          attempted_event_type: eventType,
          source: "log-operation",
          timestamp: new Date().toISOString()
        }
      );
    } catch (logError) {
      console.error(`[log-operation] Failed to log error event:`, logError);
    }
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
        correlationId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Create a shared CORS handler to consolidate headers
const handleCors = (handler: (req: Request) => Promise<Response>) => {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Add CORS headers to all responses
    const response = await handler(req);
    const newHeaders = new Headers(response.headers);
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
};

// Start the server with the CORS-wrapped handler
serve(handleCors(handler));
