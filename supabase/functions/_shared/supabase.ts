
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Initialize Supabase client (lazily to avoid unnecessary instantiation)
let _supabaseClient: any = null;

/**
 * Get a singleton Supabase client instance
 */
export function createSupabaseClient() {
  if (!_supabaseClient) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }
    
    _supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return _supabaseClient;
}
