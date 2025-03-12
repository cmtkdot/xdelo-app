
// Standardized Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Use this function to create a Supabase client with additional options
export function createSupabaseClient(options = {}) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    options
  );
}
