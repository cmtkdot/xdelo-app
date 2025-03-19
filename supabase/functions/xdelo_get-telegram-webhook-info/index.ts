
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.14.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get request body
    const requestData = await req.json();
    const { token } = requestData;
    
    if (!token) {
      return new Response(
        JSON.stringify({
          error: "Bot token is required",
          status: "failed",
          created_at: new Date().toISOString(),
        }),
        { status: 400, headers }
      );
    }

    // Generate correlation ID
    const correlationId = crypto.randomUUID();
    
    // Log the operation
    console.log(JSON.stringify({
      correlation_id: correlationId,
      component: "xdelo_get-telegram-webhook-info",
      message: "Fetching Telegram webhook info",
      timestamp: new Date().toISOString(),
    }));

    // Fetch current webhook info from Telegram API
    const telegramUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;
    
    const startTime = performance.now();
    const response = await fetch(telegramUrl);
    const webhookInfo = await response.json();
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    // Generate direct Telegram URL for verification
    const telegramSetWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook`;

    // Prepare the log entry
    const logEntry = {
      status: response.ok ? "success" : "failed",
      event_type: "get_telegram_webhook_info",
      webhook_id: correlationId,
      response_code: response.status,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
      context: {
        correlationId,
        component: "xdelo_get-telegram-webhook-info",
      }
    };

    // Save webhook log to the database
    const { error: logError } = await supabase
      .from("make_webhook_logs")
      .insert(logEntry);

    if (logError) {
      console.error("Error saving webhook log:", logError);
    }

    // Return the result
    return new Response(
      JSON.stringify({
        ...logEntry,
        webhook_info: webhookInfo.result,
        verification_urls: {
          set_webhook: telegramSetWebhookUrl,
          get_webhook_info: telegramUrl
        }
      }),
      { status: response.ok ? 200 : 400, headers }
    );
  } catch (error) {
    console.error("Error getting webhook info:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        status: "failed",
        event_type: "get_telegram_webhook_info",
        created_at: new Date().toISOString(),
      }),
      { status: 500, headers }
    );
  }
});
