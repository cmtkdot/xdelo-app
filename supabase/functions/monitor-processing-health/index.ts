
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const getMessageProcessingHealth = async (req: Request, correlationId: string) => {
  try {
    // Get counts of messages by processing state
    const { data: stateData, error: stateError } = await supabase.rpc(
      'xdelo_get_processing_state_stats'
    );
    
    if (stateError) throw new Error(`Error getting state stats: ${stateError.message}`);
    
    // Get stats on error rates
    const { data: errorData, error: errorStatsError } = await supabase.rpc(
      'xdelo_get_error_stats'
    );
    
    if (errorStatsError) throw new Error(`Error getting error stats: ${errorStatsError.message}`);
    
    // Get media group health stats
    const { data: mediaGroupData, error: mediaGroupError } = await supabase.rpc(
      'xdelo_get_media_group_health'
    );
    
    if (mediaGroupError) throw new Error(`Error getting media group health: ${mediaGroupError.message}`);
    
    // Get processing times
    const { data: timingData, error: timingError } = await supabase.rpc(
      'xdelo_get_processing_time_stats'
    );
    
    if (timingError) throw new Error(`Error getting timing stats: ${timingError.message}`);
    
    // Combined health report
    const healthReport = {
      states: stateData,
      errors: errorData,
      mediaGroups: mediaGroupData,
      timing: timingData,
      timestamp: new Date().toISOString(),
      correlation_id: correlationId
    };
    
    // Log the health check
    await supabase.from('unified_audit_logs').insert({
      event_type: 'health_check_performed',
      correlation_id: correlationId,
      metadata: healthReport,
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: healthReport
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('Error in health check:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(withErrorHandling('monitor-processing-health', getMessageProcessingHealth));
