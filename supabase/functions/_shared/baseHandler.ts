
import { corsHeaders, handleOptionsRequest } from './cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Security level for edge functions
 */
export enum SecurityLevel {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  SERVICE_ROLE = 'service_role'
}

/**
 * Options for the edge function handler
 */
export interface HandlerOptions {
  enableCors: boolean;
  enableLogging: boolean;
  securityLevel: SecurityLevel;
}

/**
 * Default handler options
 */
const defaultOptions: HandlerOptions = {
  enableCors: true,
  enableLogging: true,
  securityLevel: SecurityLevel.PUBLIC
};

/**
 * Create a Supabase client
 */
export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Helper function for retrying API requests
 */
export async function xdelo_fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 500
): Promise<Response> {
  let retries = 0;
  
  while (true) {
    try {
      const response = await fetch(url, options);
      
      if (response.ok || retries >= maxRetries) {
        return response;
      }
      
      // If we get rate limited, wait longer
      const delay = response.status === 429
        ? baseDelay * Math.pow(2, retries) + Math.random() * 1000
        : baseDelay * Math.pow(2, retries);
      
      console.log(`Request failed with status ${response.status}, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    } catch (error) {
      if (retries >= maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, retries);
      console.log(`Request failed with error: ${error.message}, retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      retries++;
    }
  }
}

/**
 * Create a standardized handler for edge functions
 */
export function createHandler(
  handlerFn: (req: Request, correlationId?: string) => Promise<Response>,
  options: Partial<HandlerOptions> = {}
) {
  // Merge the provided options with the defaults
  const config = { ...defaultOptions, ...options };
  
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight requests if CORS is enabled
    if (config.enableCors && req.method === 'OPTIONS') {
      return handleOptionsRequest();
    }
    
    // Generate a correlation ID for request tracking
    const correlationId = crypto.randomUUID();
    const startTime = performance.now();
    
    // Log the request if logging is enabled
    if (config.enableLogging) {
      try {
        console.log(JSON.stringify({
          level: 'INFO',
          message: 'Request received',
          method: req.method,
          url: req.url,
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        // Fallback simple logging if JSON.stringify fails
        console.log(`[${correlationId}] Request received: ${req.method} ${req.url}`);
      }
    }
    
    try {
      // Call the handler function with the request and correlation ID
      const response = await handlerFn(req, correlationId);
      
      // Log the response if logging is enabled
      if (config.enableLogging) {
        const duration = performance.now() - startTime;
        try {
          console.log(JSON.stringify({
            level: 'INFO',
            message: 'Response sent',
            status: response.status,
            correlation_id: correlationId,
            duration_ms: duration.toFixed(2),
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          // Fallback simple logging if JSON.stringify fails
          console.log(`[${correlationId}] Response sent: ${response.status} (${duration.toFixed(2)}ms)`);
        }
      }
      
      // Add CORS headers to the response if CORS is enabled
      if (config.enableCors) {
        const responseHeaders = new Headers(response.headers);
        
        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });
        
        // Create a new response with the CORS headers
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      }
      
      return response;
    } catch (error) {
      // Log the error if logging is enabled
      if (config.enableLogging) {
        const duration = performance.now() - startTime;
        try {
          console.error(JSON.stringify({
            level: 'ERROR',
            message: 'Error processing request',
            error: error.message,
            stack: error.stack,
            correlation_id: correlationId,
            duration_ms: duration.toFixed(2),
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          // Fallback simple logging if JSON.stringify fails
          console.error(`[${correlationId}] Error processing request: ${error.message}`);
          console.error(error.stack);
        }
      }
      
      // Create a standardized error response
      const errorResponse = new Response(
        JSON.stringify({
          error: error.message || 'Internal server error',
          success: false,
          correlation_id: correlationId,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      // Add CORS headers to the error response if CORS is enabled
      if (config.enableCors) {
        const errorHeaders = new Headers(errorResponse.headers);
        
        // Add CORS headers
        Object.entries(corsHeaders).forEach(([key, value]) => {
          errorHeaders.set(key, value);
        });
        
        // Create a new response with the CORS headers
        return new Response(errorResponse.body, {
          status: errorResponse.status,
          statusText: errorResponse.statusText,
          headers: errorHeaders
        });
      }
      
      return errorResponse;
    }
  };
}
