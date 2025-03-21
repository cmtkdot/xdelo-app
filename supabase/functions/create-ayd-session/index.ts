
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"

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
    const AYD_API_KEY = Deno.env.get('AYD_API_KEY')
    if (!AYD_API_KEY) {
      throw new Error('AYD_API_KEY is not set')
    }

    const CHATBOT_ID = Deno.env.get('AYD_CHATBOT_ID')
    if (!CHATBOT_ID) {
      throw new Error('AYD_CHATBOT_ID is not set')
    }

    // Create session with AYD API
    const response = await fetch('https://www.askyourdatabase.com/api/chatbot/v2/session', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AYD_API_KEY}`,
      },
      body: JSON.stringify({
        chatbotid: CHATBOT_ID,
        name: 'Guest',
        email: 'guest@example.com'
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AYD API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`Failed to create session: ${response.statusText}. ${errorText}`)
    }

    const data = await response.json()
    console.log('Session created successfully:', data)

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in create-ayd-session:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
