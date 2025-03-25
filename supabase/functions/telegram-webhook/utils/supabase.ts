import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Initialize the Supabase client with service role (for server-side operations)
export const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
); 