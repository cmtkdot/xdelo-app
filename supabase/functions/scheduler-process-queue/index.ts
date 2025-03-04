
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { withErrorHandling } from "../_shared/errorHandler.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler with transaction support
const handleQueueProcessing = async (req: Request, correlationId: string) => {
  console.log('Starting queue processing with correlation ID:', correlationId);
  
  // Parse request body safely
  const { limit = 20, trigger_source = 'scheduler' } = await req.json().catch(() => ({}));
  
  console.log(`Processing with limit ${limit}, triggered by ${trigger_source}`);
  
  // Initialize counters for tracking results
  let successCount = 0;
  let failedCount = 0;
  let resetCount = 0;
  let processedMessages = [];
  let errors = [];
  
  try {
    // Process pending messages with transaction integrity
    const { data: processedMessagesResult, error: processError } = await supabase
      .rpc('xdelo_process_pending_messages', {
        limit_count: limit
      });
    
    if (processError) {
      throw new Error(`Error processing messages: ${processError.message}`);
    }
    
    processedMessages = processedMessagesResult || [];
    console.log(`Processed ${processedMessages.length} pending messages`);
    
    // Track success/failure counts
    successCount = processedMessages.filter((msg: any) => msg.processed).length || 0;
    failedCount = processedMessages.filter((msg: any) => !msg.processed).length || 0;
    
    // Reset stalled messages as a separate operation
    const { data: resetMessages, error: resetError } = await supabase
      .rpc('xdelo_reset_stalled_messages');
      
    if (resetError) {
      console.error(`Error resetting stalled messages: ${resetError.message}`);
      errors.push(`Reset error: ${resetError.message}`);
    } else {
      resetCount = resetMessages?.length || 0;
      console.log(`Reset ${resetCount} stalled messages`);
    }
    
    // Log detailed results
    console.log(`Processing results: ${successCount} succeeded, ${failedCount} failed, ${resetCount} reset`);
    
    // Log the operation to audit trail
    await supabase.from('unified_audit_logs').insert({
      event_type: 'scheduler_processed_pending',
      correlation_id: correlationId,
      metadata: {
        processed: processedMessages.length,
        success: successCount,
        failed: failedCount,
        stalled_reset: resetCount,
        trigger_source: trigger_source,
        processed_message_ids: processedMessages.map((m: any) => m.message_id),
        errors: errors.length ? errors : null
      },
      event_timestamp: new Date().toISOString()
    });
    
    // Return comprehensive results
    return new Response(
      JSON.stringify({
        success: true,
        correlation_id: correlationId,
        processed: processedMessages.length,
        success_count: successCount,
        failed_count: failedCount,
        stalled_reset: resetCount,
        errors: errors.length ? errors : null,
        trigger_source: trigger_source
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scheduler:', error);
    
    // Log the error
    await supabase.from('unified_audit_logs').insert({
      event_type: 'scheduler_error',
      error_message: error.message,
      correlation_id: correlationId,
      metadata: {
        trigger_source: trigger_source,
        partial_processed: processedMessages.length,
        partial_success: successCount,
        partial_failed: failedCount,
        errors: [...errors, error.message]
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId,
        partial_results: {
          processed: processedMessages.length,
          success_count: successCount,
          failed_count: failedCount,
          stalled_reset: resetCount
        }
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
