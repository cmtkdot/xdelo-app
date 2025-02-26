
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { file_id, storage_path, mime_type } = await req.json()
    
    if (!file_id || !storage_path) {
      throw new Error('Missing required parameters')
    }

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
      throw new Error('Bot token not configured')
    }

    // Get file path from Telegram
    const getFilePath = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${file_id}`
    )
    const filePathData = await getFilePath.json()
    
    if (!filePathData.ok) {
      throw new Error('Failed to get file path from Telegram')
    }

    // Download file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePathData.result.file_path}`
    const fileResponse = await fetch(fileUrl)
    
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from Telegram')
    }

    const fileBuffer = await fileResponse.arrayBuffer()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storage_path, fileBuffer, {
        contentType: mime_type,
        upsert: true
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('telegram-media')
      .getPublicUrl(storage_path)

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
