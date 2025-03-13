
import { corsHeaders, handleOptionsRequest, createCorsResponse } from './cors.ts';

type EdgeFunctionHandler = (req: Request) => Promise<Response>;

/**
 * Creates a standardized handler function for edge functions
 */
export function createHandler(handlerFn: EdgeFunctionHandler): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return handleOptionsRequest();
    }

    try {
      const correlationId = crypto.randomUUID();
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
      
      // Call the handler function
      const response = await handlerFn(enhancedRequest);
      
      // Calculate duration
      const duration = Date.now() - startTime;
      
      // Clone the response to add headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });
      
      // Add performance metrics headers
      enhancedResponse.headers.set('X-Correlation-ID', correlationId);
      enhancedResponse.headers.set('X-Processing-Time', `${duration}ms`);
      enhancedResponse.headers.set('X-Function-Version', '1.0');
      
      // Ensure CORS headers are applied
      Object.entries(corsHeaders).forEach(([key, value]) => {
        enhancedResponse.headers.set(key, value);
      });
      
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
  methods: { [K in 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH']?: (req: Request, body?: T) => Promise<Response> }
): EdgeFunctionHandler {
  return async (req: Request) => {
    const method = req.method.toUpperCase();
    
    // Handle OPTIONS separately
    if (method === 'OPTIONS') {
      return handleOptionsRequest();
    }
    
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
  };
}
