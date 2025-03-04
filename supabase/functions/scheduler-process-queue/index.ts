
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
    console.log('Starting scheduled caption processing');
    
    // Call the new direct processing function
    const { data: processingResult, error: processError } = await supabase
      .rpc('xdelo_schedule_caption_processing');
    
    if (processError) throw new Error(`Error processing captions: ${processError.message}`);
    console.log(`Processed ${processingResult?.processed_count || 0} messages with captions`);
    
    // Log the results
    await supabase.from('unified_audit_logs').insert({
      event_type: 'scheduler_processed_captions',
      entity_id: '00000000-0000-0000-0000-000000000000', // System ID
      metadata: {
        processed_count: processingResult?.processed_count || 0
      },
      event_timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: processingResult?.processed_count || 0
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
