
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from './cors.ts'

interface CustomError extends Error {
  status?: number;
}

export const createCustomError = (message: string, status = 400): CustomError => {
  const error = new Error(message) as CustomError;
  error.status = status;
  return error;
};

export const handleError = (error: unknown) => {
  console.error('Error:', error);
  const status = (error as CustomError).status || 500;
  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
};

export const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw createCustomError('Supabase credentials not configured', 500);
  }

  return createClient(supabaseUrl, supabaseKey);
};
