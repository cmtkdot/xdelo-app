import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message_id, media_group_id, analyzed_content } = await req.json()

    if (!message_id || !media_group_id || !analyzed_content) {
      throw new Error('Missing required parameters')
    }

    // Get active Glide configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('glide_configuration')
      .select('*')
      .eq('supabase_table_name', 'messages')
      .eq('is_active', true)
      .single()

    if (configError) {
      console.error('Error fetching Glide configuration:', configError)
      throw new Error('Failed to fetch Glide configuration')
    }

    // Update the message and its group
    const { error: updateError } = await supabaseClient.rpc(
      'sync_media_group_content',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzed_content
      }
    )

    if (updateError) {
      console.error('Error updating message:', updateError)
      throw new Error('Failed to update message')
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        message: `Failed to update message: ${error}`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})