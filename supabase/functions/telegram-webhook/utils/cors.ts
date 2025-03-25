// CORS headers for Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle preflight OPTIONS request
export function handleOptionsRequest() {
  return new Response(null, { headers: corsHeaders });
}

// Check if a request is a preflight request
export function isPreflightRequest(req: Request): boolean {
  return req.method === 'OPTIONS';
}

// Create a response with CORS headers
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
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...headers,
      },
    }
  );
}

// Add CORS headers to an existing response
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

// Handle preflight CORS requests
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (isPreflightRequest(req)) {
    return handleOptionsRequest();
  }
  return null;
}
