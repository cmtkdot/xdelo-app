
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { handleMessage } from './messageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  try {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

    if (!TELEGRAM_TOKEN || !WEBHOOK_SECRET) {
      throw new Error('Missing required environment variables');
    }

    // Verify the request is from Telegram
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    if (secret !== WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await req.json();
    console.log('Received update:', JSON.stringify(update));

    if (update.message) {
      await handleMessage(update.message);
    } else if (update.chat_member) {
      await handleChatMemberUpdate(update);
    } else {
      console.log('Unhandled update type:', update);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
