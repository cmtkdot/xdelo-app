
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
  console.log('🔍 Getting file URL for fileId:', fileId)
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

    if (!update.message) {
      console.log('No message in update')
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no message' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    const message = update.message
    const chat = message.chat
    const mediaGroupId = message.media_group_id
    const photo = message.photo ? message.photo[message.photo.length - 1] : null
    const video = message.video
    const media = photo || video

    if (!media) {
      console.log('No media in message')
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no media' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

    // Step 1: Check if media already exists
    const { data: existingMedia } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single()

    let messageData
    
    // Step 2: Handle new media or caption update
    if (!existingMedia || (existingMedia && message.caption !== existingMedia.caption)) {
      // Only get file URL for new media
      const fileUrl = !existingMedia ? await getFileUrl(media.file_id) : existingMedia.public_url
      
      messageData = {
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
        processing_state: 'pending',
        telegram_data: update
      }

      // Step 3: Insert or update message
      if (existingMedia) {
        console.log('🔄 Updating existing media with new caption')
        const { data: updatedMessage, error } = await supabase
          .from('messages')
          .update(messageData)
          .eq('id', existingMedia.id)
          .select()
          .single()
          
        if (error) throw error
        messageData = updatedMessage
      } else {
        console.log('📥 Inserting new media')
        const { data: newMessage, error } = await supabase
          .from('messages')
          .insert(messageData)
          .select()
          .single()
          
        if (error) throw error
        messageData = newMessage
      }

      // Step 4: Trigger content analysis if there's a caption
      if (message.caption) {
        console.log('🔄 Triggering caption analysis')
        await supabase.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: messageData.id,
            caption: message.caption
          }
        })
      }
    } else {
      console.log('⏭️ Media already exists, skipping upload')
      messageData = existingMedia
    }

    return new Response(
      JSON.stringify({ 
        status: 'success', 
        message: 'Message processed',
        messageId: messageData.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ status: 'error', message: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
