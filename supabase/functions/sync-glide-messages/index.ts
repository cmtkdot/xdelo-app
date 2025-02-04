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
      throw new Error('Missing PABBLY_WEBHOOK_URL')
    }

    const { operation, data } = await req.json()

    console.log('📤 Sending data to Pabbly webhook:', {
      operation,
      data_id: data.id,
      has_sync_json: !!data.supabase_sync_json
    })

    // Send request to Pabbly webhook
    const response = await fetch(PABBLY_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation,
        data: data.supabase_sync_json || data // Send sync JSON if available, otherwise send full data
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Pabbly webhook error: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Successfully sent data to Pabbly webhook:', result)

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
    console.error('❌ Error:', error.message)
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