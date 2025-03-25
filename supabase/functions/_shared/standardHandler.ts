
import { corsHeaders, handleOptionsRequest, createCorsResponse, isPreflightRequest } from './cors.ts';

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
 * Creates a standardized handler function for edge functions with error handling
 */
export function createStandardHandler(
  handlerFn: (req: Request, correlationId: string) => Promise<Response>,
  options: Partial<HandlerOptions> = {}
) {
  // Merge options with defaults
  const config = { ...defaultOptions, ...options };
  
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight requests
    if (config.enableCors && isPreflightRequest(req)) {
      return handleOptionsRequest();
    }

    try {
      // Generate a correlation ID for request tracking
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      const startTime = Date.now();
      
      // Add correlation ID to headers for logging
      const headers = new Headers(req.headers);
      headers.set('X-Correlation-ID', correlationId);
      
      // Create a new request with the correlation ID
      const enhancedRequest = new Request(req.url, {
        method: req.method,
        headers,
        body: req.body,
        redirect: req.redirect
      });
      
      // Log the request if enabled
      if (config.logRequests) {
        console.log(`[${correlationId}] ${req.method} ${new URL(req.url).pathname}`);
      }
      
      // Check authentication if required
      if (config.requireAuth) {
        const token = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!token) {
          return createCorsResponse({ 
            error: 'Missing authorization token',
            success: false 
          }, { status: 401 });
        }
        
        // Token validation would go here
        // For now, we just check its presence
      }
      
      // Call the handler function
      const response = await handlerFn(enhancedRequest);
      
      // Calculate duration
      const duration = Date.now() - startTime;
      
      if (!config.enableCors) {
        return response;
      }
      
      // Add performance metrics headers if enabled
      const enhancedHeaders: Record<string, string> = {};
      
      if (config.enableMetrics) {
        enhancedHeaders['X-Correlation-ID'] = correlationId;
        enhancedHeaders['X-Processing-Time'] = `${duration}ms`;
        enhancedHeaders['X-Function-Version'] = '1.0';
      }
      
      // Clone the response with CORS headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...corsHeaders,
          ...enhancedHeaders
        }
      });
      
      // Log the response if enabled
      if (config.logResponses) {
        console.log(`[${correlationId}] Completed in ${duration}ms with status ${response.status}`);
      }
      
      return enhancedResponse;
      
    } catch (error) {
      console.error('Error in edge function:', error);
      
      // Return standardized error response
      return createCorsResponse({
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.name || 'UnknownError',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  };
}

/**
 * Type-safe wrapper for HTTP methods
 */
export function createMethodHandler<T>(
  methods: { [K in 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH']?: (req: Request, body?: T) => Promise<Response> },
  options: Partial<HandlerOptions> = {}
): (req: Request) => Promise<Response> {
  return createStandardHandler(async (req: Request) => {
    const method = req.method.toUpperCase();
    
    // Check if method is supported
    const handler = methods[method as keyof typeof methods];
    
    if (!handler) {
      return createCorsResponse({
        success: false,
        error: `Method ${method} not allowed`
      }, { status: 405 });
    }
    
    try {
      // Parse body for methods that may have one
      let body: T | undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          body = await req.json() as T;
        }
      }
      
      // Call the handler with the body if needed
      return await handler(req, body);
    } catch (error) {
      console.error(`Error in ${method} handler:`, error);
      
      return createCorsResponse({
        success: false,
        error: error.message || 'Unknown error',
        errorType: error.name || 'UnknownError'
      }, { status: 500 });
    }
  }, options);
}

/**
 * Helper to create a simple success response
 */
export function createSuccessResponse(data: any, message?: string): Response {
  return createCorsResponse({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper to create a simple error response
 */
export function createErrorResponse(
  error: Error | string, 
  status = 500, 
  additionalData: Record<string, any> = {}
): Response {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorType = typeof error === 'string' ? 'Error' : error.name;
  
  return createCorsResponse({
    success: false,
    error: errorMessage,
    errorType,
    timestamp: new Date().toISOString(),
    ...additionalData
  }, { status });
}
