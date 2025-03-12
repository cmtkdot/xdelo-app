
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

// This edge function will directly execute SQL to remove deprecated xdelo functions
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting direct database function cleanup process");
    
    // List of functions to be removed
    const functionsToRemove = [
      'xdelo_begin_transaction',
      'xdelo_commit_transaction_with_sync',
      'xdelo_handle_failed_caption_analysis',
      'xdelo_repair_media_group_syncs',
      'xdelo_reset_stalled_messages',
      'xdelo_process_pending_messages',
      'xdelo_check_processing_queue',
      'xdelo_reset_processing_state',
      'xdelo_fallback_caption_parser'
    ];
    
    // Track results
    const results = {
      removed: 0,
      errors: [],
      details: []
    };
    
    // Drop each function
    for (const funcName of functionsToRemove) {
      try {
        // Directly drop the function without checking usage
        const { error: dropError } = await supabaseClient.rpc(
          'xdelo_execute_sql_query',
          {
            p_query: `DROP FUNCTION IF EXISTS public.${funcName} CASCADE;`,
            p_params: []
          }
        );
        
        if (dropError) {
          throw new Error(`Error dropping function ${funcName}: ${dropError.message}`);
        }
        
        console.log(`Successfully removed function ${funcName}`);
        results.removed++;
        results.details.push({
          function: funcName,
          status: 'removed',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`Error dropping function ${funcName}:`, error);
        results.errors.push({
          function: funcName,
          error: error.message
        });
        results.details.push({
          function: funcName,
          status: 'error',
          error: error.message
        });
      }
    }
    
    // Log the cleanup operation
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'database_cleanup',
        entity_id: 'system',
        metadata: {
          operation: 'function_cleanup',
          functions_removed: results.removed,
          errors: results.errors.length,
          timestamp: new Date().toISOString()
        },
        correlation_id: crypto.randomUUID(),
        event_timestamp: new Date().toISOString()
      });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Database function cleanup completed: ${results.removed} functions removed, ${results.errors.length} errors`,
        results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error during database function cleanup:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
