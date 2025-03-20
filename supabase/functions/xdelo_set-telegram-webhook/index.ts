
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
          event_type: "set_telegram_webhook",
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
      component: "xdelo_set-telegram-webhook",
      message: "Setting Telegram webhook",
      timestamp: new Date().toISOString(),
    }));

    // Get the base application URL
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("app_url")
      .single();

    if (settingsError) {
      console.error("Error fetching app URL:", settingsError);
    }

    // Construct the webhook URL
    const baseUrl = settings?.app_url || `${SUPABASE_URL}/functions/v1`;
    const webhookUrl = `${baseUrl}/telegram-webhook`;
    
    // Set the webhook using the Telegram API
    const telegramUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
    
    const startTime = performance.now();
    const response = await fetch(telegramUrl);
    const telegramResponse = await response.json();
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    // Prepare the log entry
    const logEntry = {
      status: response.ok ? "success" : "failed",
      event_type: "set_telegram_webhook",
      webhook_id: correlationId,
      payload: { webhook_url: webhookUrl },
      response_code: response.status,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
      context: {
        correlationId,
        component: "xdelo_set-telegram-webhook",
      }
    };

    // Save webhook log to the database
    const { error: logError } = await supabase
      .from("make_webhook_logs")
      .insert(logEntry);

    if (logError) {
      console.error("Error saving webhook log:", logError);
    }

    // Save the webhook URL to settings
    if (response.ok && telegramResponse.ok) {
      const { error: updateError } = await supabase
        .from("settings")
        .upsert({
          id: "1",
          webhook_url: webhookUrl,
          updated_at: new Date().toISOString(),
        });

      if (updateError) {
        console.error("Error updating webhook URL in settings:", updateError);
      }
    }

    // Return the result
    return new Response(
      JSON.stringify({
        ...logEntry,
        telegram_response: telegramResponse,
      }),
      { status: response.ok ? 200 : 400, headers }
    );
  } catch (error) {
    console.error("Error setting webhook:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        status: "failed",
        event_type: "set_telegram_webhook",
        created_at: new Date().toISOString(),
      }),
      { status: 500, headers }
    );
  }
});
