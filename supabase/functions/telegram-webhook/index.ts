
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

    // Handle all types of edited messages:
    // - edited_message: for private chats and groups
    // - edited_channel_post: for channel posts
    if (update.edited_message || update.edited_channel_post) {
      const editType = update.edited_message ? 'message' : 'channel_post';
      const editedContent = update.edited_message || update.edited_channel_post;
      console.log(`📝 Handling edited ${editType}:`, {
        message_id: editedContent.message_id,
        chat_id: editedContent.chat.id,
        chat_type: editedContent.chat.type,
        edit_date: editedContent.edit_date
      });
      return await handleEditedMessage(supabase, editedContent, TELEGRAM_BOT_TOKEN);
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
