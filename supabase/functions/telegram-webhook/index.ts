import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      file_size: number;
      width: number;
      height: number;
    }>;
    video?: {
      file_id: string;
      file_unique_id: string;
      file_size: number;
      mime_type: string;
      width: number;
      height: number;
      duration: number;
    };
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

    const update: TelegramUpdate = await req.json()
    console.log('Received update:', JSON.stringify(update, null, 2))

    if (!update.message) {
      return new Response(JSON.stringify({ message: 'No message in update' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const message = update.message
    const mediaItem = message.photo?.[message.photo.length - 1] || message.video

    if (!mediaItem) {
      return new Response(JSON.stringify({ message: 'No media in message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

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

    // Create or update user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: message.from.id.toString(),
        telegram_username: message.from.username,
        telegram_first_name: message.from.first_name,
      })

    if (profileError) {
      console.error('Error updating profile:', profileError)
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
        mime_type: message.video?.mime_type || 'image/jpeg',
        file_size: mediaItem.file_size,
        width: mediaItem.width,
        height: mediaItem.height,
        duration: message.video?.duration,
        user_id: message.from.id.toString(),
      })

    if (messageError) {
      throw new Error(`Failed to store message: ${JSON.stringify(messageError)}`)
    }

    return new Response(
      JSON.stringify({ message: 'Successfully processed media message' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error processing update:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})