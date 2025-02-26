
import { corsHeaders } from './cors.ts';
import { createClient } from "@supabase/supabase-js";

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

export const createHandler = async (req: Request, handler: (supabaseClient: any, body: any) => Promise<any>) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false
        }
      }
    );

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      throw new Error('Invalid JSON payload');
    }

    // Run the actual handler
    const result = await handler(supabaseClient, body);

    // Return success response with CORS headers
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return handleError(error);
  }
};
