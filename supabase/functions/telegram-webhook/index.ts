
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from "../_shared/cors.ts";
import { TelegramUpdate, TelegramMessage } from "./types.ts";
import { validateRequest, verifyTelegramWebhookSecret } from "./authUtils.ts";
import { downloadMedia, extractMediaInfo } from "./mediaUtils.ts";
import { handleMessage, deduplicateMessage, extractChatInfo } from "./messageHandler.ts";

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const { isValid, error: validationError } = await validateRequest(req);
    if (!validationError) {
      return new Response(validationError, { status: 400, headers: corsHeaders });
    }

    // Verify webhook secret
    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!verifyTelegramWebhookSecret(req, webhookSecret)) {
      return new Response('Invalid webhook secret', { status: 401, headers: corsHeaders });
    }

    const update: TelegramUpdate = await req.json();
    console.log('Received update:', JSON.stringify(update));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract message from update
    const message = update.message || update.edited_message;
    if (!message) {
      return new Response('No message in update', { status: 200, headers: corsHeaders });
    }

    // Check for duplicate message
    const isDuplicate = await deduplicateMessage(supabase, message);
    if (isDuplicate) {
      console.log('Duplicate message detected, skipping');
      return new Response('Duplicate message', { status: 200, headers: corsHeaders });
    }

    // Extract chat information using our dedicated function
    const chatInfo = extractChatInfo(message);
    console.log('Extracted chat info:', chatInfo);

    // Handle the message
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
