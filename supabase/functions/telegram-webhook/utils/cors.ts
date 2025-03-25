// CORS headers for cross-origin requests
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204
    });
  }
  return null;
}

/**
 * Add CORS headers to a Response
 */
export function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
} 