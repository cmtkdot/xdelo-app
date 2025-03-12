
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

// This edge function will execute SQL to remove deprecated xdelo functions
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting database function cleanup process");
    
    // Get the list of functions to check before removal
    const { data: functionList, error: listError } = await supabaseClient.rpc(
      'xdelo_execute_sql_query',
      {
        p_query: `
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_type = 'FUNCTION' 
          AND routine_name LIKE 'xdelo_%'
          ORDER BY routine_name;
        `,
        p_params: []
      }
    );
    
    if (listError) {
      throw new Error(`Error fetching function list: ${listError.message}`);
    }
    
    console.log(`Found ${functionList.length} functions with xdelo_ prefix`);
    
    // List of functions that are safe to remove
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
      checked: 0,
      removed: 0,
      skipped: 0,
      errors: [],
      details: []
    };
    
    // Check recent usage of each function before removal
    for (const funcName of functionsToRemove) {
      results.checked++;
      
      try {
        // Check if function exists
        const { data: exists, error: existsError } = await supabaseClient.rpc(
          'xdelo_execute_sql_query',
          {
            p_query: `
              SELECT EXISTS(
                SELECT 1 
                FROM information_schema.routines 
                WHERE routine_schema = 'public' 
                AND routine_type = 'FUNCTION' 
                AND routine_name = $1
              );
            `,
            p_params: [funcName]
          }
        );
        
        if (existsError) {
          throw new Error(`Error checking if function exists: ${existsError.message}`);
        }
        
        if (!exists[0].exists) {
          console.log(`Function ${funcName} does not exist, skipping`);
          results.skipped++;
          results.details.push({
            function: funcName,
            status: 'skipped',
            reason: 'function does not exist'
          });
          continue;
        }
        
        // Check for recent usage in audit logs
        const { data: usageData, error: usageError } = await supabaseClient.rpc(
          'xdelo_execute_sql_query',
          {
            p_query: `
              SELECT COUNT(*) 
              FROM unified_audit_logs 
              WHERE event_type = 'function_executed' 
              AND metadata->>'function_name' = $1
              AND event_timestamp > NOW() - INTERVAL '7 days';
            `,
            p_params: [funcName]
          }
        );
        
        if (usageError) {
          throw new Error(`Error checking function usage: ${usageError.message}`);
        }
        
        const recentUsageCount = parseInt(usageData[0].count);
        
        if (recentUsageCount > 0) {
          console.log(`Function ${funcName} has been used ${recentUsageCount} times in the last 7 days, skipping removal`);
          results.skipped++;
          results.details.push({
            function: funcName,
            status: 'skipped',
            reason: `recent usage (${recentUsageCount} calls in last 7 days)`
          });
          continue;
        }
        
        // Drop the function
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
        console.error(`Error processing function ${funcName}:`, error);
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
          functions_checked: results.checked,
          functions_removed: results.removed,
          functions_skipped: results.skipped,
          errors: results.errors.length,
          timestamp: new Date().toISOString()
        },
        correlation_id: crypto.randomUUID(),
        event_timestamp: new Date().toISOString()
      });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Database function cleanup completed: ${results.removed} functions removed, ${results.skipped} skipped, ${results.errors.length} errors`,
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
