
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Create a single supabase client for interacting with your database
export const supabaseClient = createClient(
  // Deno.env.get gets environment variables
  Deno.env.get('SUPABASE_URL') ?? '',
  // Use service role key to bypass RLS
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
