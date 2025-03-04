
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler with error handling
const handleQueueProcessing = async (req: Request, correlationId: string) => {
  console.log('Starting message processing with correlation ID:', correlationId);
  
  // Parse request body safely
  const { limit = 20, trigger_source = 'scheduler' } = await req.json().catch(() => ({}));
  
  console.log(`Processing with limit ${limit}, triggered by ${trigger_source}`);
  
  try {
    // Run the scheduled processing function
    const { data: result, error } = await supabase
      .rpc('xdelo_run_scheduled_message_processing');
    
    if (error) {
      throw new Error(`Error in scheduled processing: ${error.message}`);
    }
    
    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        result,
        trigger_source
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in scheduler:', error);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'scheduler_error',
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        trigger_source,
        error_details: error.stack
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

// Serve the wrapped handler
serve(withErrorHandling('scheduler-process-queue', handleQueueProcessing));
