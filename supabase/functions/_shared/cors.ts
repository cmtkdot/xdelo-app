
// CORS headers for Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Handle OPTIONS preflight requests
export function handleOptionsRequest() {
  return new Response(null, {
    headers: corsHeaders,
    status: 204,
  });
}

// Check if request is a preflight OPTIONS request
export function isPreflightRequest(req: Request) {
  return req.method === 'OPTIONS';
}

// Create a response with CORS headers
export function createCorsResponse(body: any, options: { status?: number } = {}) {
  return new Response(
    JSON.stringify(body),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: options.status || 200,
    }
  );
}
