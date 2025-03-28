
import { corsHeaders, handleOptionsRequest, createCorsResponse } from './cors.ts';

/**
 * Security level for edge functions
 */
export enum SecurityLevel {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  SERVICE_ROLE = 'service_role'
}

/**
 * Options for the standardized handler
 */
export interface StandardizedHandlerOptions {
  enableCors: boolean;
  logRequests: boolean;
  logResponses: boolean;
  securityLevel: SecurityLevel;
}

/**
 * Default handler options
 */
const defaultOptions: StandardizedHandlerOptions = {
  enableCors: true,
  logRequests: true,
  logResponses: false,
  securityLevel: SecurityLevel.PUBLIC
};

/**
 * Create a standardized handler for edge functions with proper CORS and error handling
 */
export function xdelo_createStandardizedHandler(
  handlerFn: (req: Request, correlationId: string) => Promise<Response>,
  options: Partial<StandardizedHandlerOptions> = {}
) {
  // Merge provided options with defaults
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
    if (config.logRequests) {
      console.log(JSON.stringify({
        level: 'info',
        message: 'Request received',
        method: req.method,
        url: req.url,
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      }));
    }
    
    try {
      // Call the handler function with the request and correlation ID
      const response = await handlerFn(req, correlationId);
      
      // Log the response if logging is enabled
      if (config.logResponses) {
        const duration = performance.now() - startTime;
        console.log(JSON.stringify({
          level: 'info',
          message: 'Response sent',
          status: response.status,
          correlation_id: correlationId,
          duration_ms: duration.toFixed(2),
          timestamp: new Date().toISOString()
        }));
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
      // Log the error
      const duration = performance.now() - startTime;
      console.error(JSON.stringify({
        level: 'error',
        message: 'Error processing request',
        error: error.message,
        stack: error.stack,
        correlation_id: correlationId,
        duration_ms: duration.toFixed(2),
        timestamp: new Date().toISOString()
      }));
      
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

/**
 * Utility function for retrying API requests
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
 * Helper function to create a standardized success response
 */
export function xdelo_createSuccessResponse(
  data: any, 
  correlationId: string,
  message = 'Operation successful',
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return createCorsResponse({
    success: true,
    data,
    message,
    correlation_id: correlationId,
    timestamp: new Date().toISOString()
  }, { 
    status,
    headers: extraHeaders
  });
}

/**
 * Helper function to create a standardized error response
 */
export function xdelo_createErrorResponse(
  error: Error | string,
  correlationId: string,
  status = 400,
  extraHeaders: Record<string, string> = {}
): Response {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  return createCorsResponse({
    success: false,
    error: errorMessage,
    correlation_id: correlationId,
    timestamp: new Date().toISOString()
  }, { 
    status,
    headers: extraHeaders
  });
}
