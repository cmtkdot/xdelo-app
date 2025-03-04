
import { corsHeaders } from './cors.ts';

/**
 * Creates a standardized handler function for edge functions
 */
export function createHandler(
  handlerFn: (req: Request) => Promise<Response>
) {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const correlationId = crypto.randomUUID();
      const startTime = Date.now();
      
      // Add correlation ID to the response
      const response = await handlerFn(req);
      
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
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          errorType: error.name || 'UnknownError',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  };
}
