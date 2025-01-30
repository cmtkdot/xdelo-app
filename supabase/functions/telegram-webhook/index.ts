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
  console.log("🚀 Webhook handler started");

  if (req.method === "OPTIONS") {
    console.log("👋 Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔒 Validating webhook secret");
    await validateWebhookSecret(req);

    console.log("🔑 Checking for TELEGRAM_BOT_TOKEN");
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    console.log("🔌 Initializing Supabase client");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const rawBody = await req.text();
    console.log("📩 Raw webhook payload:", rawBody);

    let update: TelegramUpdate;
    try {
      console.log("🔄 Parsing JSON payload");
      update = JSON.parse(rawBody);
      console.log("✅ Parsed update object:", JSON.stringify(update, null, 2));
    } catch (error) {
      console.error("❌ Failed to parse JSON:", error);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    let response: WebhookResponse | null = null;

    // Handle chat member updates
    if (update.my_chat_member) {
      console.log("👤 Handling my_chat_member update");
      response = await handleChatMemberUpdate(supabase, update);
    } else {
      const message = update.message || update.channel_post;
      if (!message) {
        console.error("❌ No message or channel_post found in update");
        return new Response(
          JSON.stringify({
            message: "No content to process",
            update_type: update.my_chat_member ? "chat_member_update" : "unknown",
            update: update,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      console.log("📨 Processing message ID:", message.message_id);

      // Handle text messages without media
      if (!message.photo && !message.video && !message.document) {
        console.log("📝 Processing text message");
        response = await handleTextMessage(supabase, message);
      } else {
        // Handle media messages
        response = await handleMediaMessage(supabase, message, TELEGRAM_BOT_TOKEN);
      }
    }

    console.log("🎉 Webhook processing completed successfully");
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error processing update:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: error.message.includes("webhook secret") ? 401 : 500,
      }
    );
  }
});