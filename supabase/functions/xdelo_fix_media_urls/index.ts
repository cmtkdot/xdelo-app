
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

// Create Supabase client
const supabase = createSupabaseClient();

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { limit = 100, fixMissingPublicUrls = true, regenerateUrls = false } = await req.json();
    
    // Log the start of processing
    console.log(`Starting media URL fix operation with limit: ${limit}`);
    
    // Process up to the limit of messages with storage issues
    const { data, error } = await supabase.rpc('xdelo_fix_public_urls', {
      p_limit: limit
    });
    
    if (error) {
      throw new Error(`Error calling fix_public_urls function: ${error.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        fixed_count: data?.length || 0,
        data
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      }
    );
  }
});
