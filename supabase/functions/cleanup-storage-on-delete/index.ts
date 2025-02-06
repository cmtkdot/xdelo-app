import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from '@supabase/supabase-js'

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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message_id } = await req.json()

    // Get message details before deletion
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single()

    if (fetchError) {
      throw fetchError
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Delete storage files
    if (message.storage_path) {
      const { error: storageError } = await supabaseClient
        .storage
        .from('telegram-media')
        .remove([message.storage_path])

      if (storageError) {
        console.error('Storage deletion error:', storageError)
      }
    }

    // Delete from database
    const { error: deleteError } = await supabaseClient
      .from('messages')
      .delete()
      .eq('id', message_id)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})