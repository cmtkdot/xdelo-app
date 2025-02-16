
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { handleTextMessage, handleMediaMessage, handleChatMemberUpdate, handleEditedMessage } from "./messageHandler.ts";
import { corsHeaders } from "./authUtils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log("📥 Received update type:", {
      has_message: !!update.message,
      has_channel_post: !!update.channel_post,
      has_edited_message: !!update.edited_message,
      has_edited_channel_post: !!update.edited_channel_post,
      has_chat_member: !!update.my_chat_member,
      has_callback_query: !!update.callback_query,
      has_inline_query: !!update.inline_query,
      update_type: Object.keys(update).find(key => 
        ['message', 'channel_post', 'edited_message', 'edited_channel_post', 
         'callback_query', 'inline_query', 'my_chat_member'].includes(key)
      )
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle edited messages (both regular and channel posts)
    if (update.edited_message || update.edited_channel_post) {
      const editedMessage = update.edited_message || update.edited_channel_post;
      console.log("📝 Processing edited message:", {
        message_id: editedMessage.message_id,
        chat_id: editedMessage.chat.id,
        edit_date: editedMessage.edit_date
      });
      
      const result = await handleEditedMessage(supabase, editedMessage);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle regular messages and channel posts
    const message = update.message || update.channel_post;
    if (message) {
      if (message.text && !message.photo && !message.video && !message.document) {
        const result = await handleTextMessage(supabase, message);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        if (!TELEGRAM_BOT_TOKEN) {
          throw new Error("TELEGRAM_BOT_TOKEN is not configured");
        }
        const result = await handleMediaMessage(supabase, message, TELEGRAM_BOT_TOKEN);
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle chat member updates
    if (update.my_chat_member) {
      const result = await handleChatMemberUpdate(supabase, update);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle other types of updates by storing them in other_messages
    console.log("ℹ️ Storing unhandled update type in other_messages");
    const { error: insertError } = await supabase.from("other_messages").insert({
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: Object.keys(update).find(key => 
        ['callback_query', 'inline_query', 'chosen_inline_result', 
         'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
         'chat_join_request'].includes(key)
      ) || "unknown",
      chat_id: update.message?.chat.id || update.channel_post?.chat.id || null,
      chat_type: update.message?.chat.type || update.channel_post?.chat.type || null,
      message_text: JSON.stringify(update),
      telegram_data: update,
      processing_state: "completed"
    });

    if (insertError) {
      console.error("❌ Failed to store other message type:", insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ message: "Update processed and stored" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in webhook handler:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
