
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { processMessageQueue } from "./utils/queueProcessor.ts";

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
    const { limit = 5 } = await req.json();
    
    console.log(`Starting message queue processing with limit: ${limit}`);
    const results = await processMessageQueue(limit);
    
    console.log(`Queue processing complete: ${results.processed} processed, ${results.success} succeeded, ${results.failed} failed`);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-message-queue function:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
