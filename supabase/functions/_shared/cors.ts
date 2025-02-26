
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-custom-auth',
  'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
};

export const handleCors = (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
};

export const handleAuth = async (req: Request) => {
  // First try JWT
  const authHeader = req.headers.get('Authorization');
  
  if (authHeader) {
    // If JWT is provided, allow it to pass through
    return null;
  }

  // Then try custom auth
  const customAuth = req.headers.get('x-custom-auth');
  if (customAuth === Deno.env.get('CUSTOM_AUTH_KEY')) {
    return null;
  }

  // For webhook endpoints that use their own auth
  const path = new URL(req.url).pathname;
  if (path.includes('telegram-webhook')) {
    return null;
  }

  // If no valid auth is found
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
};
