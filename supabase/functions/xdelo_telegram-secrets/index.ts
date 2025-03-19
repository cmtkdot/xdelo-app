
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Add CORS headers to all responses
  const headers = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  try {
    // In a real implementation, we would fetch secrets from environment
    // For now, we'll just check if TELEGRAM_BOT_TOKEN exists
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    
    const tokens = [];
    if (botToken) {
      tokens.push(botToken);
    }

    return new Response(
      JSON.stringify({
        tokens,
        message: "Successfully retrieved Telegram secrets",
      }),
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Error retrieving Telegram secrets:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        message: "Failed to retrieve Telegram secrets",
      }),
      { status: 500, headers }
    );
  }
});
