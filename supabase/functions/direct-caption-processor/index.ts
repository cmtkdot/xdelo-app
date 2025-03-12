
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, correlationId = crypto.randomUUID() } = await req.json();

    if (!messageId) {
      throw new Error("messageId is required");
    }

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
      event_type: "direct_caption_processed",
      entity_id: messageId,
      correlation_id: correlationId,
      metadata: {
        processor: "direct-caption-processor",
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
    console.error("Error in direct-caption-processor:", error);

    // Attempt to log the error
    try {
      const { messageId, correlationId } = await req.json();
      await supabaseClient.from("unified_audit_logs").insert({
        event_type: "direct_caption_processor_error",
        entity_id: messageId || "unknown",
        correlation_id: correlationId || crypto.randomUUID(),
        error_message: error.message,
        metadata: {
          error_details: error.stack,
          timestamp: new Date().toISOString()
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

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
