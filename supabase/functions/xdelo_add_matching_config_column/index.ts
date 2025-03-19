
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Edge function: Add matching_config column to settings table");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Admin key (required for schema changes)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First check if the column already exists
    const { data: tableInfo, error: infoError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .limit(1);
    
    if (infoError) {
      throw new Error(`Error checking settings table: ${infoError.message}`);
    }
    
    // If the table already has the column, we don't need to create it
    if (tableInfo && tableInfo.length > 0 && 'matching_config' in tableInfo[0]) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Column already exists",
          columnExists: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Column doesn't exist, add it using raw SQL
    const { data, error } = await supabaseAdmin.rpc(
      'execute_sql_migration',
      { 
        sql_command: `
          ALTER TABLE IF EXISTS public.settings 
          ADD COLUMN IF NOT EXISTS matching_config JSONB 
          DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';
        `
      }
    );

    if (error) {
      throw new Error(`Error executing SQL: ${error.message}`);
    }

    // Log the successful operation
    await supabaseAdmin
      .from('unified_audit_logs')
      .insert({
        event_type: 'SYSTEM_EVENT',
        entity_id: 'settings_table',
        metadata: {
          operation: 'add_matching_config_column',
          success: true,
          timestamp: new Date().toISOString()
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully added matching_config column to settings table",
        columnExists: false,
        columnAdded: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
