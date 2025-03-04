
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting scheduled direct message processing');
    
    // Process pending messages directly
    const { data: processedMessages, error: processError } = await supabase
      .rpc('xdelo_process_pending_messages', {
        limit_count: 20
      });
    
    if (processError) throw new Error(`Error processing messages: ${processError.message}`);
    console.log(`Processed ${processedMessages?.length || 0} pending messages`);
    
    // Reset stalled messages
    const { data: resetMessages, error: resetError } = await supabase
      .rpc('xdelo_reset_stalled_messages');
      
    if (resetError) console.error(`Error resetting stalled messages: ${resetError.message}`);
    console.log(`Reset ${resetMessages?.length || 0} stalled messages`);
    
    // Count success and failures
    const successCount = processedMessages?.filter(item => item.processed).length || 0;
    const failedCount = processedMessages?.filter(item => !item.processed).length || 0;
    
    // Log the results
    await supabase.from('unified_audit_logs').insert({
      event_type: 'scheduler_processed_pending',
      metadata: {
        processed: processedMessages?.length || 0,
        success: successCount,
        failed: failedCount,
        stalled_reset: resetMessages?.length || 0
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: processedMessages?.length || 0,
        success_count: successCount,
        failed_count: failedCount,
        stalled_reset: resetMessages?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scheduler:', error);
    
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
});
