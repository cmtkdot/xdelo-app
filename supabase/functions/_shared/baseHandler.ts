
import { corsHeaders } from './cors.ts';

interface ErrorResponse {
  error: string;
  status: number;
  details?: any;
}

export const handleError = (error: any): Response => {
  console.error('Error:', error);

  let errorResponse: ErrorResponse = {
    error: 'Internal Server Error',
    status: 500
  };

  // Handle known error types
  if (error instanceof Error) {
    errorResponse = {
      error: error.message,
      status: error.name === 'AuthError' ? 401 : 500,
      details: Deno.env.get('ENVIRONMENT') === 'development' ? error.stack : undefined
    };
  }

  // Handle Supabase errors
  if (error?.code) {
    switch (error.code) {
      case '42P01': // undefined_table
        errorResponse = {
          error: 'Database table not found',
          status: 500,
          details: error.message
        };
        break;
      case '23505': // unique_violation
        errorResponse = {
          error: 'Duplicate record',
          status: 409,
          details: error.message
        };
        break;
      case '23503': // foreign_key_violation
        errorResponse = {
          error: 'Invalid reference',
          status: 400,
          details: error.message
        };
        break;
      default:
        errorResponse = {
          error: 'Database error',
          status: 500,
          details: error.message
        };
    }
  }

  // Return error response with CORS headers
  return new Response(
    JSON.stringify(errorResponse),
    {
      status: errorResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
};

export const createHandler = (handler: (req: Request) => Promise<Response>) => {
  return async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

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
      return handleError(error);
    }
  };
};
