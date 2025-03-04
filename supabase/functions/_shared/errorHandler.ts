
import { corsHeaders } from './cors.ts';

type ErrorHandlerFunction = (
  req: Request, 
  correlationId: string
) => Promise<Response>;

/**
 * Wraps a handler function with standardized error handling
 */
export function withErrorHandling(
  functionName: string,
  handlerFn: ErrorHandlerFunction
) {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      console.log(`Starting ${functionName} with correlation ID: ${correlationId}`);
      
      // Call the handler with correlation ID
      const response = await handlerFn(req, correlationId);
      
      // Add performance metrics headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });
      
      enhancedResponse.headers.set('X-Correlation-ID', correlationId);
      enhancedResponse.headers.set('X-Processing-Time', `${Date.now() - startTime}ms`);
      enhancedResponse.headers.set('X-Function-Name', functionName);
      
      // Ensure CORS headers are applied
      Object.entries(corsHeaders).forEach(([key, value]) => {
        enhancedResponse.headers.set(key, value);
      });
      
      return enhancedResponse;
    } catch (error) {
      console.error(`Error in ${functionName}:`, error);
      
      // Create a standardized error response
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          errorType: error.name || 'UnknownError',
          correlation_id: correlationId,
          function: functionName
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Processing-Time': `${Date.now() - startTime}ms`,
            'X-Function-Name': functionName
          }
        }
      );
    }
  };
}
