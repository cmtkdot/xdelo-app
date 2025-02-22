import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleMessage, handleEditedMessage } from './messageHandlers.ts'
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
    
    // Simplified update handling - just check for message or edit
    const message = update.message || update.channel_post
    const editedMessage = update.edited_message || update.edited_channel_post

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (message) {
      logger.info('Processing new message', { 
        messageId: message.message_id,
        isChannel: !!update.channel_post 
      })
      return await handleMessage(message, supabase, correlationId)
    }

    if (editedMessage) {
      logger.info('Processing edited message', { 
        messageId: editedMessage.message_id,
        isChannel: !!update.edited_channel_post 
      })
      return await handleEditedMessage(editedMessage, supabase, correlationId)
    }

    logger.warn('Unhandled update type', { 
      updateKeys: Object.keys(update).filter(k => k !== 'update_id')
    })
    return new Response(
      JSON.stringify({ success: false, message: 'No message to process' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

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
