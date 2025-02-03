import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret
    await validateWebhookSecret(req);
    console.log("Webhook secret validated");

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const update: TelegramUpdate = await req.json();
    console.log("Processing update:", JSON.stringify(update));

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

    console.log("Successfully processed webhook request");
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    
    const status = error.message.includes("Authorization") ? 401 : 500;
    const errorResponse = {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    
    console.log(`Responding with status ${status} and error:`, errorResponse);
    
    return new Response(JSON.stringify(errorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});