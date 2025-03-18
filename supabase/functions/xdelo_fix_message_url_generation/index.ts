
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Read the SQL script
    const sqlScript = await Deno.readTextFile(new URL("./upgrade_triggers.sql", import.meta.url));
    
    // Execute each SQL statement
    const statements = sqlScript.split(';').filter(stmt => stmt.trim() !== '');
    
    const results = [];
    for (const stmt of statements) {
      try {
        const { data, error } = await supabase.rpc('xdelo_run_sql', { sql: stmt + ';' });
        if (error) {
          console.error("Error executing SQL statement:", error);
          results.push({ success: false, error: error.message, statement: stmt.substring(0, 100) + '...' });
        } else {
          results.push({ success: true, statement: stmt.substring(0, 100) + '...' });
        }
      } catch (e) {
        console.error("Error executing SQL statement:", e);
        results.push({ success: false, error: e.message, statement: stmt.substring(0, 100) + '...' });
      }
    }
    
    // Run the function to update the triggers
    const { data, error } = await supabase.rpc('xdelo_update_message_url_triggers');
    
    if (error) {
      throw error;
    }

    // Log the success
    console.log("Successfully updated message URL triggers:", data);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully updated message URL triggers",
        data,
        sql_execution_results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error updating message URL triggers:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
