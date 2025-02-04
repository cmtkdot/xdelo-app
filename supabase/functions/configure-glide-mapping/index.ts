import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Handle CORS preflight requests
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Default column mapping based on your Glide configuration
    const defaultMapping = {
      'mFvhH': 'id',
      '59aiF': 'telegram_message_id',
      '3tdPG': 'media_group_id',
      'BSLlx': 'message_caption_id',
      '1QYuk': 'is_original_caption',
      '551pz': 'group_caption_synced',
      'iFtJQ': 'caption',
      'ImQQi': 'file_id',
      'rxGro': 'file_unique_id',
      '9xPNx': 'public_url',
      'L9F1w': 'mime_type',
      '8fwgA': 'telegram_data',
      'TUJHC': 'analyzed_content',
      'IocHd': 'created_at',
      'r2UKT': 'updated_at',
      'fNLdN': 'group_message_count',
      'THs1j': 'processing_state'
    }

    // Insert or update the configuration
    const { data, error } = await supabaseClient
      .from('glide_messages_configuration')
      .upsert({
        glide_table_name: 'native-table-dR5SGqrIbrfg2OKEWWB3',
        field_mappings: defaultMapping,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})