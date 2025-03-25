
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_syncMediaGroupContent } from "../_shared/captionProcessing.ts";

// Set up CORS headers for browser clients
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request = await req.json();
    
    // Validate required fields
    if (!request.mediaGroupId) {
      throw new Error("Missing required parameter: mediaGroupId");
    }
    
    if (!request.sourceMessageId) {
      throw new Error("Missing required parameter: sourceMessageId");
    }
    
    console.log("Media group sync request received:", {
      mediaGroupId: request.mediaGroupId,
      sourceMessageId: request.sourceMessageId,
      forceSync: request.forceSync,
      syncEditHistory: request.syncEditHistory,
      correlationId: request.correlationId
    });
    
    // Call the shared media group sync function
    const result = await xdelo_syncMediaGroupContent(
      supabaseClient,
      request.sourceMessageId,
      request.mediaGroupId,
      request.correlationId || crypto.randomUUID(),
      request.forceSync === true,
      request.syncEditHistory === true
    );
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        media_group_id: request.mediaGroupId,
        source_message_id: request.sourceMessageId,
        synced_count: result.data?.updated_count || 0,
        sync_details: result.data
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`Error in media group sync: ${error.message}`);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
