
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./authUtils.ts";
import { handleTextMessage, handleMediaMessage, handleChatMemberUpdate, handleEditedMessage } from "./messageHandler.ts";

serve(async (req) => {
  console.log("📥 Received webhook request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log("🔄 Processing update:", JSON.stringify(update));

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle edited messages
    if (update.edited_message) {
      console.log("📝 Handling edited message");
      return await handleEditedMessage(supabase, update.edited_message, TELEGRAM_BOT_TOKEN);
    }

    // Original message handling logic
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

    console.log("✅ Successfully processed webhook request");
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
