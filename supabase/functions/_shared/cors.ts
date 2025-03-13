
// Standard CORS headers for Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Helper function to apply CORS headers to a Response
 */
export function addCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  
  // Add CORS headers to the response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  
  return newResponse;
}

/**
 * Create a CORS-enabled Response
 */
export function createCorsResponse(
  body: any, 
  options: { status?: number; headers?: Record<string, string> } = {}
): Response {
  const { status = 200, headers = {} } = options;
  
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...headers
      }
    }
  );
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleOptionsRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
