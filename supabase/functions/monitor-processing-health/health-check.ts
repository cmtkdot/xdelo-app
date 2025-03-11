
import { supabaseClient } from '../_shared/supabase.ts';
import { corsHeaders } from '../_shared/cors.ts';

export async function checkProcessingHealth(req: Request) {
  try {
    const { trigger_repair = false } = await req.json().catch(() => ({}));
    const correlationId = crypto.randomUUID();
    
    console.log(`Performing health check, correlation ID: ${correlationId}`);
    
    // Get system health metrics
    const { data: healthMetrics, error: healthError } = await supabaseClient.rpc(
      'xdelo_get_message_processing_stats'
    );
    
    if (healthError) {
      throw new Error(`Error getting processing health metrics: ${healthError.message}`);
    }
    
    // Log the successful health check
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'health_check_success',
      correlation_id: correlationId,
      metadata: {
        health_metrics: healthMetrics,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        health_metrics: healthMetrics
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in health check:', error);
    
    // Log the error
    try {
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'health_check_error',
        error_message: error.message,
        metadata: {
          error_stack: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log health check error:', logError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
