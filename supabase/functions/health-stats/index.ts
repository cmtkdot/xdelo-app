
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const correlationId = crypto.randomUUID();
    
    console.log(`Health stats request, correlation ID: ${correlationId}`);
    
    // Get system health metrics
    const { data: healthMetrics, error: healthError } = await supabaseClient.rpc(
      'xdelo_get_message_processing_stats'
    );
    
    if (healthError) {
      console.error(`Error getting processing health metrics: ${healthError.message}`);
      throw new Error(`Failed to retrieve health metrics: ${healthError.message}`);
    }
    
    // Log successful retrieval
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'health_stats_api_request',
        correlation_id: correlationId,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'edge_function'
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log health stats request:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        health_metrics: healthMetrics,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    console.error('Error in health-stats function:', error);
    
    // Log the error
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'health_stats_api_error',
        error_message: error.message,
        metadata: {
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log health stats error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
