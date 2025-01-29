import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

interface TelegramUpdate {
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    media_group_id?: string;
    caption?: string;
    photo?: TelegramMedia[];
    video?: TelegramMedia;
    document?: TelegramMedia;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Log the raw request body for debugging
    const rawBody = await req.text()
    console.log('Raw request body:', rawBody)

    let update: TelegramUpdate
    try {
      update = JSON.parse(rawBody)
    } catch (error) {
      console.error('Failed to parse JSON:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('Received update:', JSON.stringify(update, null, 2))

    if (!update.message) {
      return new Response(
        JSON.stringify({ message: 'No message in update' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const message = update.message
    const mediaItem = message.photo?.[message.photo.length - 1] || message.video || message.document

    if (!mediaItem) {
      return new Response(
        JSON.stringify({ message: 'No media in message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing media with the same file_unique_id
    const { data: existingMedia } = await supabase
      .from('messages')
      .select('id, public_url')
      .eq('file_unique_id', mediaItem.file_unique_id)
      .single()

    let publicUrl = existingMedia?.public_url

    if (!publicUrl) {
      // Get file info from Telegram
      const fileInfoResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${mediaItem.file_id}`
      )
      const fileInfo = await fileInfoResponse.json()

      if (!fileInfo.ok) {
        throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`)
      }

      // Download file from Telegram
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
      const fileResponse = await fetch(fileUrl)
      const fileBlob = await fileResponse.blob()

      // Upload to Supabase Storage
      const fileExt = fileInfo.result.file_path.split('.').pop()
      const { error: uploadError } = await supabase.storage
        .from('telegram-media')
        .upload(`${mediaItem.file_unique_id}.${fileExt}`, fileBlob, {
          contentType: message.video?.mime_type || 'image/jpeg',
          upsert: true
        })

      if (uploadError) {
        throw new Error(`Failed to upload file: ${JSON.stringify(uploadError)}`)
      }

      // Generate public URL
      publicUrl = `https://ovpsyrhigencvzlxqwqz.supabase.co/storage/v1/object/public/telegram-media/${mediaItem.file_unique_id}.${fileExt}`
    }

    // Store message data
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        telegram_message_id: message.message_id,
        media_group_id: message.media_group_id,
        caption: message.caption,
        file_id: mediaItem.file_id,
        file_unique_id: mediaItem.file_unique_id,
        public_url: publicUrl,
        mime_type: message.video?.mime_type || 'image/jpeg',
        file_size: mediaItem.file_size,
        width: mediaItem.width,
        height: mediaItem.height,
        duration: mediaItem.duration,
        user_id: message.from.id.toString(),
        telegram_data: update
      })

    if (messageError) {
      throw new Error(`Failed to store message: ${JSON.stringify(messageError)}`)
    }

    return new Response(
      JSON.stringify({ message: 'Successfully processed media message' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing update:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})