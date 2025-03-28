
// Standard CORS headers for Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id',
  'Access-Control-Max-Age': '86400', // 24 hours caching for preflight requests
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
  
  const contentType = typeof body === 'string' 
    ? 'text/plain'
    : 'application/json';
    
  const responseBody = typeof body === 'string' 
    ? body 
    : JSON.stringify(body);
    
  return new Response(responseBody, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      ...headers
    }
  });
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

/**
 * Helper to check if request is a preflight request
 */
export function isPreflightRequest(request: Request): boolean {
  return request.method === 'OPTIONS';
}
