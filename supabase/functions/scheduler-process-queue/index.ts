
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
    console.log('Starting scheduled queue processing');
    
    // First find and queue any unprocessed messages
    const { data: queuedMessages, error: queueError } = await supabase
      .rpc('xdelo_queue_unprocessed_messages', {
        limit_count: 20
      });
    
    if (queueError) throw new Error(`Error queueing messages: ${queueError.message}`);
    console.log(`Found and queued ${queuedMessages?.length || 0} unprocessed messages`);
    
    // Process the queue (up to 10 messages at once)
    const processResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-message-queue`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ limit: 10 })
      }
    );
    
    if (!processResponse.ok) {
      throw new Error(`Error processing queue: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    const result = await processResponse.json();
    
    // Log the results
    await supabase.from('unified_audit_logs').insert({
      event_type: 'scheduler_processed_queue',
      metadata: {
        queued_count: queuedMessages?.length || 0,
        processed: result.data?.processed || 0,
        success: result.data?.success || 0,
        failed: result.data?.failed || 0
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        queued: queuedMessages?.length || 0,
        processed: result.data?.processed || 0,
        success: result.data?.success || 0,
        failed: result.data?.failed || 0
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
