
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a Supabase client with the auth context of the function
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
    console.log('Starting process-unanalyzed-messages function');
    const { limit = 10 } = await req.json();
    
    // First, queue unanalyzed messages
    const { data: queuedMessages, error: queueError } = await supabase.rpc(
      'xdelo_queue_unprocessed_messages',
      { limit_count: limit }
    );
    
    if (queueError) {
      throw new Error(`Error queueing messages: ${queueError.message}`);
    }
    
    const queuedCount = queuedMessages?.length || 0;
    console.log(`Queued ${queuedCount} unanalyzed messages`);
    
    if (queuedCount === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No unanalyzed messages to process'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Process the queue
    const processResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-message-queue`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ limit: queuedCount })
      }
    );
    
    if (!processResponse.ok) {
      throw new Error(`Error processing queue: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    const processResult = await processResponse.json();
    
    // Log the operation
    await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'unanalyzed_messages_processed',
        metadata: {
          queued_messages: queuedCount,
          processed_messages: processResult.data.processed,
          success_count: processResult.data.success,
          failed_count: processResult.data.failed
        },
        event_timestamp: new Date().toISOString()
      });
    
    return new Response(
      JSON.stringify({
        success: true,
        queued: queuedCount,
        processed: processResult.data.processed,
        success: processResult.data.success,
        failed: processResult.data.failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-unanalyzed-messages function:', error);
    
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
