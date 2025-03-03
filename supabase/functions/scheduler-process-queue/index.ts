
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting scheduled queue processing');
    
    // Get the pending messages count
    const { data: pendingCountData } = await supabase
      .from('message_processing_queue')
      .select('count', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    const pendingCount = pendingCountData?.count || 0;
    
    if (pendingCount === 0) {
      console.log('No pending messages in queue');
      return new Response(
        JSON.stringify({ success: true, pendingCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${pendingCount} pending messages, initiating processing`);
    
    // Process up to 5 messages in parallel
    const processCount = Math.min(pendingCount, 5);
    const processingPromises = [];
    
    for (let i = 0; i < processCount; i++) {
      processingPromises.push(
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-message-queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ scheduled: true })
        })
      );
      
      // Add a small delay between invocations to avoid race conditions
      if (i < processCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const results = await Promise.allSettled(processingPromises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Processing complete: ${successCount} succeeded, ${failureCount} failed`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        pendingCount,
        processedCount: processCount,
        successCount,
        failureCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scheduler-process-queue function:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
