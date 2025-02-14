
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./authUtils.ts";
import { handleTextMessage, handleMediaMessage, handleChatMemberUpdate } from "./messageHandler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    
    // Check if this is an edited message
    if (update.edited_message || update.edited_channel_post) {
      console.log("📝 Routing edited message to edit handler");
      
      // Forward to the edited-webhook function
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase credentials not configured");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { error: editHandlerError } = await supabase.functions.invoke(
        'telegram-edited-webhook',
        {
          body: update
        }
      );

      if (editHandlerError) {
        throw editHandlerError;
      }

      return new Response(
        JSON.stringify({ success: true, message: "Edit processed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle regular messages as before
    console.log("📥 Received update:", {
      has_message: !!update.message,
      has_channel_post: !!update.channel_post,
      message_type: update.message?.text ? 'text' : update.message?.photo ? 'photo' : update.message?.video ? 'video' : update.message?.document ? 'document' : 'other'
    });

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

    // Handle regular messages
    const message = update.message || update.channel_post;
    if (!message) {
      return new Response(
        JSON.stringify({ message: "No message content to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different types of updates
    let result;
    if (update.my_chat_member) {
      result = await handleChatMemberUpdate(supabase, update);
    } else if (message.text && !message.photo && !message.video && !message.document) {
      result = await handleTextMessage(supabase, message);
    } else {
      result = await handleMediaMessage(supabase, message, TELEGRAM_BOT_TOKEN);
    }

    return new Response(
      JSON.stringify(result),
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
