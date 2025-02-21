
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

if (!supabaseUrl || !supabaseServiceRole || !telegramToken) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRole)

async function getFileUrl(fileId: string): Promise<string> {
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
  )
  const data = await response.json()
  if (!data.ok) throw new Error('Failed to get file path')
  return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const update = await req.json()
    console.log('📥 Received webhook update:', JSON.stringify(update))

    // Early validation
    if (!update.message) {
      await supabase.rpc('xdelo_log_webhook_event', {
        p_event_type: 'skipped',
        p_error_message: 'No message in update',
        p_raw_data: update
      })
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no message' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    const message = update.message
    const chat = message.chat
    const mediaGroupId = message.media_group_id
    
    // Check for media content
    const photo = message.photo ? message.photo[message.photo.length - 1] : null
    const video = message.video
    const media = photo || video

    if (!media) {
      await supabase.rpc('xdelo_log_webhook_event', {
        p_event_type: 'skipped',
        p_chat_id: chat.id,
        p_message_id: message.message_id,
        p_error_message: 'No media in message',
        p_raw_data: update
      })
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no media' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Log media reception
    await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: 'media_received',
      p_chat_id: chat.id,
      p_message_id: message.message_id,
      p_media_type: photo ? 'photo' : 'video',
      p_raw_data: update
    })

    try {
      // Get the file URL first
      const fileUrl = await getFileUrl(media.file_id)
      console.log('📁 Got file URL:', fileUrl)

      // Insert into messages table with initial state
      const { data: insertedMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          telegram_message_id: message.message_id,
          chat_id: chat.id,
          chat_type: chat.type,
          chat_title: chat.title,
          media_group_id: mediaGroupId,
          caption: message.caption || '',
          file_id: media.file_id,
          file_unique_id: media.file_unique_id,
          public_url: fileUrl,
          mime_type: video ? video.mime_type : 'image/jpeg',
          file_size: media.file_size,
          width: media.width,
          height: media.height,
          duration: video?.duration,
          message_url: `https://t.me/c/${chat.id.toString().slice(4)}/${message.message_id}`,
          processing_state: 'initialized',
          telegram_data: update
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Log successful media storage
      await supabase.rpc('xdelo_log_webhook_event', {
        p_event_type: 'media_stored',
        p_chat_id: chat.id,
        p_message_id: message.message_id,
        p_media_type: photo ? 'photo' : 'video'
      })

      // If there's a caption, trigger AI processing
      if (message.caption) {
        console.log('🔄 Triggering caption processing for message:', message.message_id)
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: insertedMessage.id,
            caption: message.caption
          }
        })
      }

      return new Response(
        JSON.stringify({ 
          status: 'success', 
          message: 'Media processed successfully',
          messageId: insertedMessage.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )

    } catch (error) {
      console.error('❌ Error processing media:', error)
      await supabase.rpc('xdelo_log_webhook_event', {
        p_event_type: 'error',
        p_chat_id: chat.id,
        p_message_id: message.message_id,
        p_media_type: photo ? 'photo' : 'video',
        p_error_message: error.message
      })
      throw error
    }

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
