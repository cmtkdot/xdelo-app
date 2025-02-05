import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'

interface Message {
  id: string;
  telegram_message_id: number;
  media_group_id?: string;
  caption?: string;
  public_url?: string;
  analyzed_content?: Record<string, any>;
  processing_state?: string;
  created_at?: string;
  updated_at?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch messages from the messages table
    const { data: messages, error } = await supabaseClient
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    // Return the messages data
    return new Response(
      JSON.stringify({ messages }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})