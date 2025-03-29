
// Standardized Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Singleton instance of the Supabase client
export const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        "X-Client-Info": "edge-function", // Add standard header
      },
    },
  }
);

// Note: Removed createSupabaseClient function and executeQuery/handleSupabaseError helpers.
// These should reside in appropriate utility files if needed elsewhere.
