
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "@supabase/supabase-js";
import { handleMessage } from "./messageHandlers.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const correlationId = crypto.randomUUID();

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    // Handle different types of updates
    const update = body;
    let messageData;

    if (update.message) {
      messageData = { type: 'message', data: update.message };
    } else if (update.edited_message) {
      messageData = { type: 'edited_message', data: update.edited_message };
    } else if (update.channel_post) {
      messageData = { type: 'channel_post', data: update.channel_post };
    } else if (update.edited_channel_post) {
      messageData = { type: 'edited_channel_post', data: update.edited_channel_post };
    }

    if (messageData) {
      await handleMessage(supabase, messageData.data, botToken, correlationId, messageData.type);
    } else {
      // Store other types of messages
      const { error } = await supabase
        .from('other_messages')
        .insert({
          telegram_message_id: update.message?.message_id || update.update_id,
          chat_id: update.message?.chat?.id || 0,
          chat_type: update.message?.chat?.type || 'unknown',
          message_type: 'other',
          telegram_data: update,
          correlation_id: correlationId
        });

      if (error) {
        throw error;
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
