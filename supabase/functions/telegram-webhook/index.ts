import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders, validateWebhookSecret } from "./authUtils.ts";
import {
  handleChatMemberUpdate,
  handleTextMessage,
  handleMediaMessage,
} from "./messageHandler.ts";
import type { TelegramUpdate, WebhookResponse } from "./types.ts";

serve(async (req) => {
  console.log("Received webhook request");

  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate the webhook secret
    await validateWebhookSecret(req);
    console.log("Webhook secret validated successfully");

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const update: TelegramUpdate = await req.json();
    console.log("Received update:", JSON.stringify(update));

    let response: WebhookResponse | null = null;

    if (update.my_chat_member) {
      response = await handleChatMemberUpdate(supabase, update);
    } else {
      const message = update.message || update.channel_post;
      if (!message) {
        return new Response(
          JSON.stringify({
            message: "No content to process",
            update_type: "unknown",
            update: update,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      if (!message.photo && !message.video && !message.document) {
        response = await handleTextMessage(supabase, message);
      } else {
        response = await handleMediaMessage(supabase, message, TELEGRAM_BOT_TOKEN);
      }
    }

    console.log("Processing completed successfully");
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    
    const status = error.message.includes("Authorization") ? 401 : 500;
    console.log(`Responding with status ${status}`);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});