
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set");
    }

    const update = await req.json();
    console.log("📥 Received update:", { update });

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const message = update.message || update.channel_post;
    if (!message) {
      console.log("No message found in update");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract message details
    const telegram_message_id = message.message_id;
    const chat_id = message.chat.id;
    const chat_type = message.chat.type;
    const chat_title = message.chat.title;
    const media_group_id = message.media_group_id;
    const caption = message.caption;
    
    // Handle different types of media
    let file_info = null;
    if (message.photo) {
      file_info = message.photo[message.photo.length - 1]; // Get largest photo
    } else if (message.video) {
      file_info = message.video;
    } else if (message.document) {
      file_info = message.document;
    }

    if (!file_info) {
      console.log("No media found in message");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Construct the message URL
    const message_url = `https://t.me/c/${Math.abs(chat_id).toString()}/${telegram_message_id}`;

    // Insert into database
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        telegram_message_id,
        chat_id,
        chat_type,
        chat_title,
        media_group_id,
        caption,
        file_id: file_info.file_id,
        file_unique_id: file_info.file_unique_id,
        mime_type: file_info.mime_type,
        file_size: file_info.file_size,
        width: file_info.width,
        height: file_info.height,
        telegram_data: message,
        message_url,
        processing_state: caption ? 'pending' : 'initialized'
      });

    if (insertError) {
      console.error("Error inserting message:", insertError);
      throw insertError;
    }

    // If message has caption, trigger AI analysis
    if (caption) {
      // The message will be picked up by the process-unanalyzed-messages function
      console.log("Message queued for AI analysis");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
