import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message_id, caption, media_group_id } = await req.json()

    if (!message_id) {
      throw new Error('Message ID is required')
    }

    console.log('Reanalyzing message:', { message_id, media_group_id })

    // Call the parse-caption-with-ai function
    const response = await supabaseClient.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id,
        caption,
        media_group_id,
        correlation_id: crypto.randomUUID()
      }
    })

    if (response.error) {
      throw new Error(`AI Analysis failed: ${response.error.message}`)
    }

    console.log('Analysis completed:', response.data)

    return new Response(
      JSON.stringify({ success: true, data: response.data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in reanalyze-low-confidence function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})