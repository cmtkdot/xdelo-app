import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "./authUtils.ts";
import type { TelegramUpdate } from "./types.ts";

serve(async (req) => {
  console.log("Received webhook request");

  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log("Processing update:", JSON.stringify(update));

    // Forward to unified media processor
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/unified-media-processor`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(update),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Unified processor error: ${errorText}`);
    }

    const result = await response.json();
    console.log("Successfully processed webhook request");
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    
    const errorResponse = {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    
    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});