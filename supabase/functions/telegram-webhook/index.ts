import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleWebhookUpdate } from './messageHandlers.ts'
import { verifyTelegramWebhook } from './authUtils.ts'
import { getLogger } from './logger.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const correlationId = crypto.randomUUID()
  const logger = getLogger(correlationId)

  try {
    const update = await req.json()
    
    // Better update type detection
    const updateType = getUpdateType(update)
    logger.info('Received webhook update', { updateType, correlationId })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    switch (updateType) {
      case 'message':
        return await handleMessage(update.message, supabase, correlationId)
      case 'edited_message':
        return await handleEditedMessage(update.edited_message, supabase, correlationId)
      case 'channel_post':
        return await handleChannelPost(update.channel_post, supabase, correlationId)
      case 'edited_channel_post':
        return await handleEditedChannelPost(update.edited_channel_post, supabase, correlationId)
      default:
        logger.warn('Unhandled update type', { updateType })
        return new Response(
          JSON.stringify({ success: false, message: 'Unhandled update type' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    logger.error('Webhook error:', { error })
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

// Helper to determine update type
function getUpdateType(update: any): string {
  if (update.message) return 'message'
  if (update.edited_message) return 'edited_message'
  if (update.channel_post) return 'channel_post'
  if (update.edited_channel_post) return 'edited_channel_post'
  
  // Log available keys to help debug
  const updateKeys = Object.keys(update).filter(k => k !== 'update_id')
  console.warn('❌ No message or channel_post in update. Update keys:', updateKeys)
  
  return 'unknown'
}
