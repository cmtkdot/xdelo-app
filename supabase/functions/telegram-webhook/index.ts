import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./authUtils.ts";
import { 
  handleTextMessage, 
  handleMediaMessage, 
  handleChatMemberUpdate,
  handleMessageEdit,
  handleMessageDelete
} from "./messageHandler.ts";

serve(async (req) => {
  console.log("📥 Received webhook request");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log("🔄 Processing update type:", Object.keys(update).join(', '));

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

    // Debug logging
    console.log("🔍 Debug: Update object structure:", JSON.stringify(update, null, 2));
    
    // Disable Glide sync temporarily
    const ENABLE_GLIDE_SYNC = false;
    
    let result;

    // Handle different types of updates
    if (update.edited_message || update.edited_channel_post) {
      // Handle message edits
      const editedMessage = update.edited_message || update.edited_channel_post;
      console.log("✏️ Handling message edit");
      result = await handleMessageEdit(supabase, editedMessage);
    }
    else if (update.message_delete || update.channel_post_delete) {
      // Handle message deletions
      const deletedMessage = update.message_delete || update.channel_post_delete;
      console.log("🗑️ Handling message deletion");
      result = await handleMessageDelete(supabase, deletedMessage);
    }
    else if (update.my_chat_member) {
      // Handle chat member updates
      console.log("👥 Handling chat member update");
      result = await handleChatMemberUpdate(supabase, update);
    }
    else {
      // Handle regular messages
      const message = update.message || update.channel_post;
      if (!message) {
        return new Response(
          JSON.stringify({ message: "No content to process" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (message.text && !message.photo && !message.video && !message.document) {
        console.log("💬 Handling text message");
        result = await handleTextMessage(supabase, message);
      } else {
        console.log("📸 Handling media message");
        result = await handleMediaMessage(supabase, message, TELEGRAM_BOT_TOKEN);
      }
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