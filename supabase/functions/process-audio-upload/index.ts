
import { serve } from "std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // First, try to get the audio file from storage
    const { data: audioData, error: audioError } = await supabase
      .storage
      .from('product-audio')
      .download(entry.storage_path)

    if (audioError) {
      throw new Error(`Failed to download audio file: ${audioError.message}`)
    }

    // Convert the audio data to a blob
    const audioBlob = new Blob([audioData], { type: 'audio/webm' })

    // Prepare form data for Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('response_format', 'verbose_json')

    // Send to OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text()
      console.error('Whisper API error:', errorText)
      throw new Error(`Whisper API error: ${errorText}`)
    }

    const whisperResult = await whisperResponse.json()
    console.log('Whisper transcription:', whisperResult)

    // Update the entry with transcription
    const { error: updateError } = await supabase
      .from('raw_product_entries')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString(),
        extracted_data: {
          transcription: whisperResult.text,
          confidence: whisperResult.segments[0]?.confidence || 0,
          processed_at: new Date().toISOString()
        },
        needs_manual_review: true
      })
      .eq('id', entryId)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ 
        message: 'Audio processing completed',
        entryId,
        transcription: whisperResult.text
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
