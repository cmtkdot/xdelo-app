
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
    const { count: pendingCount, error: countError } = await supabase
      .from('message_processing_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (countError) {
      throw new Error(`Error getting pending count: ${countError.message}`);
    }
    
    if (pendingCount === 0) {
      console.log('No pending messages in queue');
      return new Response(
        JSON.stringify({ success: true, pendingCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${pendingCount} pending messages, initiating processing`);
    
    // Process up to 10 messages
    const processCount = Math.min(pendingCount, 10);
    
    const processResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-message-queue`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ limit: processCount })
      }
    );
    
    if (!processResponse.ok) {
      throw new Error(`Error processing queue: ${processResponse.status} ${processResponse.statusText}`);
    }
    
    const processResult = await processResponse.json();
    
    console.log(`Processing complete: ${processResult.data.success} succeeded, ${processResult.data.failed} failed`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        pendingCount,
        processedCount: processResult.data.processed,
        successCount: processResult.data.success,
        failureCount: processResult.data.failed
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
