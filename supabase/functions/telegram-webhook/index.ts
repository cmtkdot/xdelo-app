import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./authUtils.ts";
import { handleMessage } from "./messageHandler.ts";
import { extractChatInfo } from "./messageHandler.ts";
import { TelegramUpdate } from "./types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  try {
    const update: TelegramUpdate = await req.json();
    console.log("📥 Received update:", {
      correlation_id: correlationId,
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

    // Handle all message types (regular messages, channel posts, and their edits)
    const message = update.message || update.channel_post || 
                   update.edited_message || update.edited_channel_post;
                   
    if (message) {
      const chatInfo = extractChatInfo(message);
      console.log('Processing message for chat:', {
        correlation_id: correlationId,
        chat_info: chatInfo,
        is_edit: !!(update.edited_message || update.edited_channel_post)
      });

      const result = await handleMessage(supabase, message, chatInfo);
      console.log('Message processing result:', {
        correlation_id: correlationId,
        result
      });

      return new Response(
        JSON.stringify({ success: true, result }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle other types of updates by storing them in other_messages
    console.log("ℹ️ Storing unhandled update type:", {
      correlation_id: correlationId,
      update_type: Object.keys(update).find(key => 
        ['callback_query', 'inline_query', 'chosen_inline_result', 
         'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
         'chat_join_request', 'my_chat_member'].includes(key)
      ) || "unknown"
    });

    const { error: insertError } = await supabase.from("other_messages").insert({
      user_id: "f1cdf0f8-082b-4b10-a949-2e0ba7f84db7",
      message_type: Object.keys(update).find(key => 
        ['callback_query', 'inline_query', 'chosen_inline_result', 
         'shipping_query', 'pre_checkout_query', 'poll', 'poll_answer',
         'chat_join_request', 'my_chat_member'].includes(key)
      ) || "unknown",
      chat_id: update.message?.chat.id || update.channel_post?.chat.id || null,
      chat_type: update.message?.chat.type || update.channel_post?.chat.type || null,
      chat_title: update.message?.chat.title || update.channel_post?.chat.title || null,
      message_text: JSON.stringify(update),
      telegram_data: update,
      processing_state: "completed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (insertError) {
      console.error("❌ Failed to store other message type:", {
        correlation_id: correlationId,
        error: insertError
      });
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        message: "Update processed and stored",
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Error in webhook handler:", {
      correlation_id: correlationId,
      error
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
