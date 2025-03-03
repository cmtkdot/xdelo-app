
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { processMessageQueue } from "./utils/queueProcessor.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse the limit parameter
    const { limit = 5 } = await req.json();
    console.log(`Request to process up to ${limit} messages from the queue`);
    
    // Process messages from the queue
    const results = await processMessageQueue(limit);
    
    // Return the results
    return new Response(
      JSON.stringify({ 
        success: true, 
        data: results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message queue:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
