
import { corsHeaders, handleCors, handleAuth } from './cors.ts';

export const createHandler = (handler: (req: Request) => Promise<Response>) => {
  return async (req: Request) => {
    // Handle CORS
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    // Handle Auth
    const authResponse = await handleAuth(req);
    if (authResponse) return authResponse;

    try {
      // Run the actual handler
      const response = await handler(req);
      
      // Ensure CORS headers are added
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
          stack: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
  };
};
