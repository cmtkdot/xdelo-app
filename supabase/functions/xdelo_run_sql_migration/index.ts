
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

serve(async (req) => {
  try {
    // Create a Supabase client with the Admin key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Parse the request body
    const { sql, correlation_id } = await req.json();
    
    if (!sql) {
      return new Response(
        JSON.stringify({ error: "No SQL statement provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Log the SQL operation start
    await logProcessingEvent(
      "SQL_MIGRATION_STARTED",
      "system",
      correlation_id || crypto.randomUUID().toString(),
      { sql_length: sql.length },
      undefined,
      "system"
    );

    // Execute the SQL query
    const { data, error } = await supabaseClient.rpc(
      "execute_sql_migration",
      { p_sql: sql }
    );

    if (error) {
      // Log error
      await logProcessingEvent(
        "SQL_MIGRATION_FAILED",
        "system",
        correlation_id || crypto.randomUUID().toString(),
        { error: error.message },
        error.message,
        "system"
      );

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Log success
    await logProcessingEvent(
      "SQL_MIGRATION_COMPLETED",
      "system",
      correlation_id || crypto.randomUUID().toString(),
      { result: data },
      undefined,
      "system"
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: data 
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log uncaught exception
    await logProcessingEvent(
      "SQL_MIGRATION_ERROR",
      "system",
      crypto.randomUUID().toString(),
      { error: error.message },
      error.message,
      "system"
    );

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || String(error) 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
