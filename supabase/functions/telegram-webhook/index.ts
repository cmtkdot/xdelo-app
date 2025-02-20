
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from "../_shared/cors.ts";
import { TelegramUpdate } from "./types.ts";
import { handleMessage, extractChatInfo } from "./messageHandler.ts";

const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Verify webhook secret from header
    const signature = req.headers.get('x-telegram-bot-api-secret-token');
    if (signature !== webhookSecret) {
      return new Response('Invalid webhook secret', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update));

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const message = update.message || update.edited_message;
    if (!message) {
      return new Response('No message in update', { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    const chatInfo = extractChatInfo(message);
    console.log('Processing message for chat:', chatInfo);

    const result = await handleMessage(supabase, message, chatInfo);
    console.log('Message processing result:', result);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
