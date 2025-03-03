
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "./cors.ts";

// Create a Supabase client
export const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Base handler wrapper for consistent error handling and CORS
export function createHandler(handler: (req: Request, supabase: any) => Promise<Response>) {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Call the actual handler function
      return await handler(req, supabaseClient);
    } catch (error) {
      console.error('Error handling request:', error);
      
      // Return consistent error response
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Unknown error occurred'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}

// Helper to create JSON response
export function createJsonResponse(data: any, status = 200) {
  return new Response(
    JSON.stringify(data),
    { 
      status, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}
