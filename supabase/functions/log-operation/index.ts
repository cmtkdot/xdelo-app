
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logProcessingEvent } from "../_shared/auditLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LogOperationRequest {
  eventType: string;
  entityId: string;
  metadata?: Record<string, any>;
}

/**
 * Handler for logging operations to the unified audit system
 */
const handler = async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the request body
    const { eventType, entityId, metadata = {} } = await req.json() as LogOperationRequest;

    // Validate required parameters
    if (!eventType || !entityId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required parameters (eventType, entityId)",
          correlationId: crypto.randomUUID().toString(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate a correlation ID for this request
    const correlationId = crypto.randomUUID().toString();

    // Log the operation
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
    console.error("Error in log-operation:", error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        correlationId: crypto.randomUUID().toString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Start the server
serve(handler);
