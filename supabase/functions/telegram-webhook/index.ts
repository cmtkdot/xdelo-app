import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

interface TelegramMessage {
  message_id: number
  from: {
    id: number
    first_name: string
    username?: string
  }
  chat: {
    id: number
    type: string
  }
  date: number
  media_group_id?: string
  photo?: Array<{
    file_id: string
    file_unique_id: string
    width: number
    height: number
    file_size?: number
  }>
  video?: {
    file_id: string
    file_unique_id: string
    width: number
    height: number
    duration: number
    mime_type?: string
    file_size?: number
  }
  caption?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
    )
    const data = await response.json()
    if (data.ok && data.result.file_path) {
      return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${data.result.file_path}`
    }
  } catch (error) {
    console.error('Error getting file URL:', error)
  }
  return null
}

async function downloadAndUploadFile(fileId: string, mimeType: string): Promise<string | null> {
  try {
    const fileUrl = await getFileUrl(fileId)
    if (!fileUrl) return null

    const response = await fetch(fileUrl)
    const fileData = await response.arrayBuffer()
    
    const fileName = `${crypto.randomUUID()}.${mimeType.split('/')[1]}`
    const { data, error } = await supabase.storage
      .from('telegram-media')
      .upload(fileName, fileData, {
        contentType: mimeType,
        upsert: false
      })

    if (error) {
      console.error('Error uploading to storage:', error)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('telegram-media')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    console.error('Error downloading/uploading file:', error)
    return null
  }
}

async function handleMediaMessage(message: TelegramMessage, userId: string) {
  const mediaItem = message.photo ? message.photo[message.photo.length - 1] : message.video

  if (!mediaItem) {
    console.error('No media found in message')
    return
  }

  const mimeType = message.video?.mime_type || 'image/jpeg'
  const publicUrl = await downloadAndUploadFile(mediaItem.file_id, mimeType)

  if (!publicUrl) {
    console.error('Failed to process media file')
    return
  }

  const { error } = await supabase.from('messages').insert({
    telegram_message_id: message.message_id,
    media_group_id: message.media_group_id,
    caption: message.caption,
    file_id: mediaItem.file_id,
    file_unique_id: mediaItem.file_unique_id,
    public_url: publicUrl,
    mime_type: mimeType,
    file_size: mediaItem.file_size,
    width: mediaItem.width,
    height: mediaItem.height,
    duration: 'duration' in mediaItem ? mediaItem.duration : null,
    user_id: userId
  })

  if (error) {
    console.error('Error inserting message:', error)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const update: TelegramUpdate = await req.json()
    console.log('Received update:', JSON.stringify(update))

    if (!update.message) {
      return new Response(JSON.stringify({ message: 'No message in update' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Get user_id from profiles based on Telegram username or create new profile
    const telegramUsername = update.message.from.username
    let { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_username', telegramUsername)
      .single()

    if (!profile && telegramUsername) {
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          telegram_username: telegramUsername,
          telegram_user_id: update.message.from.id.toString()
        })
        .select()
        .single()

      if (profileError) {
        throw profileError
      }
      profile = newProfile
    }

    if (!profile) {
      throw new Error('Could not find or create user profile')
    }

    if (update.message.photo || update.message.video) {
      await handleMediaMessage(update.message, profile.id)
    }

    return new Response(JSON.stringify({ message: 'Update processed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error) {
    console.error('Error processing update:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})