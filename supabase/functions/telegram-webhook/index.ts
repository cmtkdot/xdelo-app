
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  // Setup logger for this request
  const logger = {
    info: (message: string, data?: any) => {
      console.log(`[${correlationId}] ℹ️ ${message}`, data ? data : '');
    },
    error: (message: string, error?: any) => {
      console.error(`[${correlationId}] ❌ ${message}`, error ? error : '');
    }
  };

  try {
    const rawBody = await req.text();
    logger.info('📝 Raw request body:', rawBody);

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      logger.error('Failed to parse JSON:', e);
      return new Response(
        JSON.stringify({ status: 'error', reason: 'invalid json' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    logger.info('📥 Parsed webhook update:', update);

    // Handle both regular messages and channel posts
    const message = update.message || update.channel_post;
    
    if (!message) {
      logger.info('No message or channel_post in update', { update_keys: Object.keys(update) });
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'no message or channel_post',
          update_keys: Object.keys(update)
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const context = {
      supabaseClient: supabase,
      logger,
      correlationId,
      botToken: Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
    };

    // Import and use message handler
    const { handleMessage } = await import('./messageHandlers.ts');
    const result = await handleMessage(update, context);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    );

  } catch (error) {
    logger.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message,
        correlation_id: correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
