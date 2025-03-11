
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trigger_repair = false } = await req.json().catch(() => ({}));
    const correlationId = crypto.randomUUID();
    
    console.log(`Starting processing health monitoring, correlation ID: ${correlationId}`);
    
    // Get system health metrics
    const { data: healthMetrics, error: healthError } = await supabaseClient.rpc(
      'xdelo_get_message_processing_stats'
    );
    
    if (healthError) {
      throw new Error(`Error getting processing health metrics: ${healthError.message}`);
    }
    
    console.log(`Processing health metrics:`, healthMetrics);
    
    // Check if repair is needed or requested
    const stuckProcessing = healthMetrics?.media_group_stats?.stuck_in_processing || 0;
    const orphanedMessages = healthMetrics?.media_group_stats?.orphaned_media_group_messages || 0;
    const needsRepair = stuckProcessing > 0 || orphanedMessages > 0;
    
    let repairResult = null;
    
    // Trigger repair if needed and requested
    if ((needsRepair || trigger_repair) && !req.headers.get('x-prevent-repair')) {
      console.log(`Triggering processing system repair due to: stuck=${stuckProcessing}, orphaned=${orphanedMessages}`);
      
      const { data, error } = await supabaseClient.functions.invoke(
        'repair-processing-flow',
        {
          body: { 
            limit: 20,
            repair_enums: true,
            force_reset_stalled: true,
            trigger_source: 'health_monitor'
          }
        }
      );
      
      if (error) {
        console.error(`Error during repair: ${error.message}`);
      } else {
        repairResult = data;
        console.log(`Repair completed:`, repairResult);
      }
    }
    
    // Log the health check
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'processing_health_monitoring',
      correlation_id: correlationId,
      metadata: {
        health_metrics: healthMetrics,
        needs_repair: needsRepair,
        repair_triggered: repairResult !== null,
        repair_result: repairResult,
        trigger_repair_requested: trigger_repair
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        health_metrics: healthMetrics,
        needs_repair: needsRepair,
        repair_triggered: repairResult !== null,
        repair_result: repairResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in monitor-processing-health:', error);
    
    // Log the error
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'health_monitoring_error',
        error_message: error.message,
        metadata: {
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log monitoring error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
