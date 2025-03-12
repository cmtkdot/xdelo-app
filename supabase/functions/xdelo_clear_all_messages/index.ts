
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleError } from '../_shared/errorHandler.ts';

const handler = async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Authenticate the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Call the database function to clear all messages
    const { data, error } = await supabaseClient.rpc('xdelo_clear_all_messages');
    
    if (error) throw error;
    
    return new Response(
      JSON.stringify({ success: true, message: 'All messages deleted successfully', details: data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return handleError(error, 'Error clearing messages');
  }
};

serve(handler);
