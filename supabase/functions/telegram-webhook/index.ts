
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
    // 1. Basic validation
    if (!req.body) {
      throw new Error('No request body')
    }

    // 2. Auth check
    const isValid = await verifyTelegramWebhook(req)
    if (!isValid) {
      throw new Error('Invalid webhook signature')
    }

    // 3. Parse update
    const update = await req.json()
    logger.info('Received webhook update', { 
      updateType: Object.keys(update).filter(k => k !== 'update_id'),
      correlationId 
    })

    // 4. Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 5. Process update
    const result = await handleWebhookUpdate(supabase, update, correlationId)

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500
      }
    )

  } catch (error) {
    logger.error('Webhook error:', { error })
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Webhook error',
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
