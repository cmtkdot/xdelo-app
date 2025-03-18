
// Supabase Edge Function to process message captions
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Set up CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize the Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse the request body
    const { messageId, correlationId = crypto.randomUUID() } = await req.json();

    if (!messageId) {
      throw new Error("messageId is required");
    }

    console.log(`Processing caption for message ${messageId}, correlation_id: ${correlationId}`);

    // Call the database function to process the caption
    const { data, error } = await supabaseClient.rpc(
      "xdelo_process_caption_workflow",
      {
        p_message_id: messageId,
        p_correlation_id: correlationId
      }
    );

    if (error) {
      throw new Error(`Error processing caption: ${error.message}`);
    }

    // Log the successful operation
    await supabaseClient.from("unified_audit_logs").insert({
      event_type: "caption_processed",
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        processor: "xdelo_process_captions",
        result: data,
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        data,
        message_id: messageId,
        correlation_id: correlationId
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error in caption processor:", error);

    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
