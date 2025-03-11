
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
  const { limit = 20, trigger_source = 'scheduler', repair = false } = await req.json().catch(() => ({}));
  
  console.log(`Processing with limit ${limit}, triggered by ${trigger_source}, repair mode: ${repair}`);
  
  try {
    let result;
    
    if (repair) {
      // Run diagnostics and repair operations
      console.log('Running repair mode...');
      
      // Try to ensure event types exist first
      try {
        await supabase.rpc('xdelo_ensure_event_types_exist');
        console.log('Enum values checked/repaired');
      } catch (enumError) {
        console.warn('Could not repair enums from scheduler, continuing:', enumError);
      }
      
      // Call the diagnostic function
      const { data: diagResult, error: diagError } = await supabase
        .rpc('xdelo_diagnose_queue_issues')
        .catch(err => {
          console.warn('Diagnostic function error (non-critical):', err);
          return { data: { status: 'error', message: err.message }, error: err };
        });
      
      result = {
        repair_mode: true,
        diagnostics: diagError ? { error: diagError.message } : diagResult
      };
      
      // Additionally, repair any message relationships
      const { data: repairResult, error: repairError } = await supabase
        .rpc('xdelo_repair_message_relationships')
        .catch(err => {
          console.warn('Relationship repair function error (non-critical):', err);
          return { data: null, error: err };
        });
        
      if (!repairError) {
        result.relationship_repairs = repairResult;
      }
      
      // Also try to run the direct repair process
      try {
        await supabase.functions.invoke('repair-processing-flow', {
          body: { limit: 10, repair_enums: true }
        });
      } catch (repairFlowError) {
        console.warn('Repair flow function error (non-critical):', repairFlowError);
      }
    } else {
      // Regular processing - run the scheduled processing function
      const { data: scheduleResult, error: scheduleError } = await supabase
        .rpc('xdelo_run_scheduled_message_processing')
        .catch(err => {
          console.warn('Scheduled processing function error:', err);
          return { data: null, error: err };
        });
      
      if (scheduleError) {
        // Try adding enum values and retry
        try {
          await supabase.rpc('xdelo_ensure_event_types_exist');
          console.log('Enum values repaired, retrying processing...');
          
          // Retry after fixing enum values
          const { data: retryResult, error: retryError } = await supabase
            .rpc('xdelo_run_scheduled_message_processing');
            
          if (retryError) {
            throw new Error(`Error in scheduled processing after enum fix: ${retryError.message}`);
          }
          
          result = retryResult;
        } catch (enumError) {
          throw new Error(`Error fixing enums and processing: ${enumError.message}`);
        }
      } else {
        result = scheduleResult;
      }
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
    
    // Try to log the error, but don't fail if logging fails
    try {
      await supabase.from('unified_audit_logs').insert({
        event_type: 'scheduler_process_error',
        error_message: error.message,
        correlation_id: correlationId,
        metadata: {
          trigger_source,
          error_details: error.stack
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log error (possible enum issue):', logError);
    }
    
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
