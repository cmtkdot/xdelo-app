
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface WebResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: any;
}

serve(async (req) => {
  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the settings table has the matching_config column
    const { data: tableInfo, error: infoError } = await supabase
      .from('settings')
      .select('*')
      .limit(1);
    
    if (infoError) {
      console.error("Error checking settings table:", infoError);
      throw new Error(`Error checking settings table: ${infoError.message}`);
    }
    
    // Check if matching_config column already exists
    if (tableInfo && tableInfo.length > 0 && 'matching_config' in tableInfo[0]) {
      // Column already exists, no need to add it
      return new Response(
        JSON.stringify({
          success: true,
          message: "Matching config column already exists",
        } as WebResponse),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    
    // Add the column if it doesn't exist
    const query = `
      ALTER TABLE IF EXISTS public.settings 
      ADD COLUMN IF NOT EXISTS matching_config JSONB DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';
      
      CREATE INDEX IF NOT EXISTS idx_product_matching_text 
      ON public.gl_products USING gin(main_product_name gin_trgm_ops, main_vendor_product_name gin_trgm_ops);
    `;
    
    const { error: alterError } = await supabase.rpc(
      'xdelo_execute_sql_migration',
      { sql_command: query }
    );
    
    if (alterError) {
      console.error("Error executing SQL migration:", alterError);
      throw new Error(`Error adding matching_config column: ${alterError.message}`);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully added matching_config column to settings table",
      } as WebResponse),
      { headers: { "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in xdelo_add_matching_config_column:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: "Error adding matching_config column",
        error: error.message,
      } as WebResponse),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
