
import { createStandardHandler, SecurityLevel } from "../_shared/standardHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Main handler function
const handleStandardizeUrls = async (req: Request, correlationId: string) => {
  try {
    const { limit = 500, bucket = "telegram-media" } = await req.json();
    
    console.log(`Running URL standardization for up to ${limit} records`);
    
    // Store Supabase URL in app_settings if not exists
    await supabase.rpc('ensure_app_settings_exists', {
      p_supabase_url: supabaseUrl
    });
    
    // Call the database function to standardize URLs
    const { data, error } = await supabase.rpc('fix_public_urls', {
      p_limit: limit
    });
    
    if (error) throw new Error(`Database error: ${error.message}`);
    
    return new Response(
      JSON.stringify({
        success: true,
        updated_count: data?.length || 0,
        correlation_id: correlationId,
        message: `Successfully standardized ${data?.length || 0} URLs`
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${correlationId}] Error standardizing URLs:`, error);
    throw error;
  }
};

// Export the handler with our standard wrapper
export default createStandardHandler(handleStandardizeUrls, {
  securityLevel: SecurityLevel.SERVICE_ROLE
});
