import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }

    const { message_id, chat_id, media_group_id } = await req.json();
    console.log("Deleting message:", { message_id, chat_id, media_group_id });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete message from Telegram
    const deleteUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`;
    const response = await fetch(deleteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chat_id,
        message_id: message_id,
      }),
    });

    const result = await response.json();
    console.log("Telegram deletion result:", result);

    if (!result.ok) {
      throw new Error(`Failed to delete Telegram message: ${result.description}`);
    }

    // If it's part of a media group, delete all related messages
    if (media_group_id) {
      const { data: relatedMessages, error: fetchError } = await supabase
        .from('messages')
        .select('telegram_message_id, chat_id')
        .eq('media_group_id', media_group_id);

      if (fetchError) throw fetchError;

      // Delete all related messages from Telegram
      for (const msg of relatedMessages || []) {
        if (msg.telegram_message_id === message_id) continue; // Skip the one we just deleted

        await fetch(deleteUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: msg.chat_id,
            message_id: msg.telegram_message_id,
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error deleting Telegram message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});