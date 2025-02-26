
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { handleMessage } from "./messageHandlers.ts";

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
    // Initialize Supabase Admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify JWT token if it's a manual request
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
      
      if (authError || !user) {
        logger.error('Invalid JWT token');
        return new Response(
          JSON.stringify({ status: 'error', message: 'Unauthorized' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }
      logger.info('Manual request authenticated', { userId: user.id });
    } else {
      // For Telegram webhook requests, verify using the webhook secret
      const telegramSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
      const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
      
      if (!secretHeader || secretHeader !== telegramSecret) {
        logger.error('Invalid Telegram webhook secret');
        return new Response(
          JSON.stringify({ status: 'error', message: 'Unauthorized' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        );
      }
      logger.info('Telegram webhook request authenticated');
    }

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

    const context = {
      supabaseClient: supabase,
      logger,
      correlationId,
      botToken: Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
    };

    const result = await handleMessage(update, context);

    // Log the request to webhook_logs table
    await supabase
      .from('webhook_logs')
      .insert({
        event_type: 'telegram_webhook',
        chat_id: message.chat.id,
        telegram_message_id: message.message_id,
        media_type: message.photo ? 'photo' : message.video ? 'video' : 'other',
        raw_data: update,
        correlation_id: correlationId
      });

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
