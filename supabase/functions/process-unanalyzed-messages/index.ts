
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request parameters
    const { limit = 10 } = await req.json();
    console.log(`Request to queue up to ${limit} unanalyzed messages`);
    
    // Find and queue unprocessed messages
    const { data, error } = await supabaseClient.rpc('xdelo_queue_unprocessed_messages', {
      limit_count: limit
    });
    
    if (error) {
      throw error;
    }
    
    const successCount = data?.filter(item => item.queued).length || 0;
    const errorCount = data?.filter(item => !item.queued).length || 0;
    
    console.log(`Queued ${successCount} messages, ${errorCount} failed`);
    
    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          queued: successCount,
          failed: errorCount,
          details: data
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error queuing unanalyzed messages:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
