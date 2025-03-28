
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Support CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    const { messageIds } = await req.json();
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No message IDs provided"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Call the direct-caption-processor function with the specific message IDs
    const processorResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/direct-caption-processor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          specificIds: messageIds,
          forceReprocess: true
        })
      }
    );

    if (!processorResponse.ok) {
      let errorMessage = "Failed to process messages";
      try {
        const errorData = await processorResponse.json();
        errorMessage = errorData.error || errorMessage;
      } catch {}

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const result = await processorResponse.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unknown error occurred"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
