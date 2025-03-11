
// This handles wrapping edge functions with standardized error handling
export const withErrorHandling = (funcName: string, handler: (req: Request, correlationId: string) => Promise<Response>) => {
  return async (req: Request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Generate a correlation ID for tracking this request
    const correlationId = crypto.randomUUID();
    const startTime = performance.now();

    try {
      console.log(`${funcName} started with correlation ID: ${correlationId}`);
      const response = await handler(req, correlationId);
      
      // Add correlation ID and timing headers
      const headers = new Headers(response.headers);
      headers.set('X-Correlation-ID', correlationId);
      headers.set('X-Processing-Time', `${(performance.now() - startTime).toFixed(2)}ms`);
      
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      console.log(`${funcName} completed successfully in ${(performance.now() - startTime).toFixed(2)}ms`);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const stackTrace = error instanceof Error ? error.stack : 'No stack trace';
      
      console.error(`${funcName} error: ${errorMessage}`);
      console.error(`Stack trace: ${stackTrace}`);
      
      // Create an error response with CORS headers and correlation ID
      const errorHeaders = new Headers(corsHeaders);
      errorHeaders.set('X-Correlation-ID', correlationId);
      errorHeaders.set('X-Processing-Time', `${(performance.now() - startTime).toFixed(2)}ms`);
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          correlation_id: correlationId,
          function: funcName,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: errorHeaders
        }
      );
    }
  };
};
