import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get entry ID from request
    const { entryId } = await req.json()

    if (!entryId) {
      throw new Error('Entry ID is required')
    }

    // Get the entry details
    const { data: entry, error: fetchError } = await supabase
      .from('raw_product_entries')
      .select('*')
      .eq('id', entryId)
      .single()

    if (fetchError) {
      throw fetchError
    }

    if (!entry.audio_url) {
      throw new Error('No audio URL found for entry')
    }

    console.log(`Processing audio entry: ${entryId}`)
    console.log(`Audio URL: ${entry.audio_url}`)

    // Here you would typically:
    // 1. Download the audio file
    // 2. Send it to a speech-to-text service
    // 3. Process the text to extract product information
    // 4. Update the entry with the extracted data

    // For now, we'll just update the status
    const { error: updateError } = await supabase
      .from('raw_product_entries')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        extracted_data: {
          // This would be replaced with actual extracted data
          transcription: "Audio transcription would go here",
          confidence: 0.95,
          processed_at: new Date().toISOString()
        }
      })
      .eq('id', entryId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        message: 'Audio processing completed',
        entryId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error processing audio:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
