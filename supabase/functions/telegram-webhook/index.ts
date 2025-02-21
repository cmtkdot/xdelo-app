
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
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
    )
    const data = await response.json()
    if (!data.ok) {
      console.error('❌ Failed to get file path:', data)
      throw new Error(`Failed to get file path: ${JSON.stringify(data)}`)
    }
    console.log('✅ Successfully got file path:', data.result.file_path)
    return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`
  } catch (error) {
    console.error('❌ Error getting file URL:', error)
    throw error
  }
}

async function handleMediaGroupSync(mediaGroupId: string, messageId: string, caption: string | null) {
  console.log('🔄 Handling media group sync:', { mediaGroupId, messageId, hasCaption: !!caption })
  try {
    if (!mediaGroupId) return

    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)

    if (groupError) {
      console.error('❌ Error fetching group messages:', groupError)
      throw groupError
    }

    const totalMessages = groupMessages.length
    console.log(`📊 Found ${totalMessages} messages in group ${mediaGroupId}`)

    // Update all messages in the group with the count
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        group_message_count: totalMessages,
        group_caption_synced: caption ? true : false
      })
      .eq('media_group_id', mediaGroupId)

    if (updateError) {
      console.error('❌ Error updating group messages:', updateError)
      throw updateError
    }

    console.log('✅ Successfully synchronized media group')
  } catch (error) {
    console.error('❌ Error in media group sync:', error)
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const update = await req.json()
    console.log('📥 Received webhook update:', JSON.stringify(update))
    
    const startTime = Date.now()

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
      // Check for existing media with same file_unique_id
      const { data: existingMedia } = await supabase
        .from('messages')
        .select('*')
        .eq('file_unique_id', media.file_unique_id)
        .single()

      // Get the file URL
      const fileUrl = await getFileUrl(media.file_id)
      console.log('📁 Got file URL:', fileUrl)

      const messageData = {
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
        telegram_data: update,
        is_edited: message.edit_date ? true : false,
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null
      }

      let insertedMessage
      
      if (existingMedia && message.caption !== existingMedia.caption) {
        // Update existing media with new caption
        console.log('🔄 Updating existing media with new caption')
        const { data: updatedMessage, error: updateError } = await supabase
          .from('messages')
          .update({
            ...messageData,
            processing_state: 'pending'
          })
          .eq('id', existingMedia.id)
          .select()
          .single()

        if (updateError) throw updateError
        insertedMessage = updatedMessage
      } else if (!existingMedia) {
        // Insert new media
        console.log('📥 Inserting new media')
        const { data: newMessage, error: insertError } = await supabase
          .from('messages')
          .insert(messageData)
          .select()
          .single()

        if (insertError) throw insertError
        insertedMessage = newMessage
      } else {
        console.log('⏭️ Skipping duplicate media with same caption')
        insertedMessage = existingMedia
      }

      // Handle media group synchronization
      if (mediaGroupId) {
        await handleMediaGroupSync(mediaGroupId, insertedMessage.id, message.caption)
      }

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

      const processTime = Date.now() - startTime
      console.log(`✅ Processing completed in ${processTime}ms`)

      return new Response(
        JSON.stringify({ 
          status: 'success', 
          message: 'Media processed successfully',
          messageId: insertedMessage.id,
          processingTime: processTime
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
        p_error_message: error.message,
        p_raw_data: update
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
