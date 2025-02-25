
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'
import { TelegramWebhookPayload, WebhookResponse, Config } from './types.ts'
import {
  handleMediaMessage,
  handleTextMessage,
  handleChannelPost
} from './utils/messageHandlers.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize configuration
    const config: Config = {
      supabaseUrl: Deno.env.get('SUPABASE_URL') || '',
      supabaseKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      telegramBotToken: Deno.env.get('TELEGRAM_BOT_TOKEN') || '',
      webhookSecret: Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || ''
    }

    // Verify webhook secret
    const authHeader = req.headers.get('x-telegram-bot-api-secret-token')
    if (authHeader !== config.webhookSecret) {
      throw new Error('Unauthorized: Invalid webhook secret')
    }

    // Parse request body
    const payload: TelegramWebhookPayload = await req.json()

    // Initialize Supabase client
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)

    // Process the message based on its type
    let response: WebhookResponse
    
    if (payload.message?.photo || payload.message?.video || payload.message?.document) {
      response = await handleMediaMessage(payload.message, supabase, config)
    } else if (payload.message?.text) {
      response = await handleTextMessage(payload.message, supabase)
    } else if (payload.channel_post) {
      response = await handleChannelPost(payload.channel_post, supabase)
    } else {
      response = {
        success: false,
        message: 'Unsupported message type'
      }
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.success ? 200 : 400
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
