import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const PABBLY_WEBHOOK_URL = Deno.env.get('PABBLY_WEBHOOK_URL')

    if (!PABBLY_WEBHOOK_URL) {
      console.error('❌ Configuration Error: Missing PABBLY_WEBHOOK_URL')
      throw new Error('Missing PABBLY_WEBHOOK_URL')
    }

    const { operation, data } = await req.json()

    console.log('📥 Received webhook request:', {
      operation,
      data_id: data?.id,
      has_sync_json: !!data?.supabase_sync_json,
      webhook_url: PABBLY_WEBHOOK_URL.substring(0, 30) + '...' // Log partial URL for debugging
    })

    if (!data) {
      throw new Error('No data provided in webhook request')
    }

    const payload = {
      operation,
      data: data.supabase_sync_json || data
    }

    console.log('📤 Preparing to send data to Pabbly:', {
      operation,
      has_data: !!payload.data,
      data_keys: Object.keys(payload.data || {})
    })

    // Send request to Pabbly webhook
    const response = await fetch(PABBLY_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Pabbly webhook error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`Pabbly webhook error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Successfully sent data to Pabbly webhook:', {
      status: response.status,
      result_keys: Object.keys(result)
    })

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('❌ Error in webhook handler:', {
      error: error.message,
      stack: error.stack
    })
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})