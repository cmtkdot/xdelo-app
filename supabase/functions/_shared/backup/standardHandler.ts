
import { corsHeaders } from "./cors.ts";

export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated",
  SERVICE_ROLE = "service_role"
}

export interface HandlerOptions {
  securityLevel: SecurityLevel;
  logRequests?: boolean;
  logResponses?: boolean;
}

export const defaultOptions: HandlerOptions = {
  securityLevel: SecurityLevel.PUBLIC,
  logRequests: true,
  logResponses: false
};

/**
 * Create a standardized handler for Edge Functions with error handling
 */
export function createStandardHandler(
  handlerFn: (req: Request, correlationId: string) => Promise<Response>,
  options: Partial<HandlerOptions> = {}
) {
  const config = { ...defaultOptions, ...options };
  
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Generate a correlation ID for request tracking
    const correlationId = crypto.randomUUID();
    
    // Log request if enabled
    if (config.logRequests) {
      console.log(`[Request ${correlationId}] ${req.method} ${req.url}`);
    }
    
    try {
      // JWT verification would be handled here for AUTHENTICATED/SERVICE_ROLE
      // if (config.securityLevel !== SecurityLevel.PUBLIC) { ... }
      
      // Time the execution
      const startTime = performance.now();
      const response = await handlerFn(req, correlationId);
      const duration = performance.now() - startTime;
      
      // Log response if enabled
      if (config.logResponses) {
        console.log(`[Response ${correlationId}] ${response.status} (${duration.toFixed(2)}ms)`);
      }
      
      // Ensure CORS headers are on the response
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      console.error(`[Error ${correlationId}]`, error);
      
      // Return standardized error response
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
          correlationId,
          success: false,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  };
}
