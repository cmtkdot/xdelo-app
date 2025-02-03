import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { corsHeaders } from "./authUtils.ts";
import type { TelegramUpdate } from "./types.ts";
import { handleTextMessage, handleMediaMessage, handleChatMemberUpdate } from "./messageHandler.ts";

serve(async (req) => {
  console.log("Received webhook request");

  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    console.log("Processing update:", JSON.stringify(update));

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const message = update.message || update.channel_post;
    if (!message) {
      return new Response(
        JSON.stringify({ message: "No content to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    if (update.my_chat_member) {
      result = await handleChatMemberUpdate(supabase, update);
    } else if (message.text && !message.photo && !message.video && !message.document) {
      result = await handleTextMessage(supabase, message);
    } else {
      result = await handleMediaMessage(supabase, message, TELEGRAM_BOT_TOKEN);
    }

    console.log("Successfully processed webhook request");
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing webhook:", error);
    
    const errorResponse = {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});