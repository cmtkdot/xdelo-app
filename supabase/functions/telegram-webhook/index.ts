
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseClient } from '../_shared/supabase.ts'
import { handleMediaMessage, handleOtherMessage } from './messageHandlers.ts'
import { extractMediaInfo } from './mediaUtils.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, edited_message } = await req.json()
    const updateMessage = edited_message || message
    
    const correlationId = crypto.randomUUID()
    console.log('Received webhook update:', { 
      correlationId, 
      messageType: updateMessage?.chat?.type,
      isEdit: !!edited_message
    })

    if (updateMessage) {
      const isChannelPost = updateMessage.chat.type === 'channel'
      const isForwarded = updateMessage.forward_from || updateMessage.forward_from_chat
      
      console.log('Processing message:', {
        message_id: updateMessage.message_id,
        chat_id: updateMessage.chat.id,
        is_channel_post: isChannelPost,
        is_forwarded: isForwarded,
        is_edit: !!edited_message,
        has_media: !!updateMessage.photo || !!updateMessage.video || !!updateMessage.document
      })

      // Extract media info if present
      const mediaInfo = extractMediaInfo(updateMessage)

      if (mediaInfo) {
        // Get file path from Telegram
        const fileResponse = await fetch(
          `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/getFile?file_id=${mediaInfo.file_id}`
        )
        const fileData = await fileResponse.json()

        if (!fileData.ok) {
          throw new Error(`Failed to get file path: ${fileData.description}`)
        }

        const filePath = fileData.result.file_path
        const fileUrl = `https://api.telegram.org/file/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/${filePath}`

        // Download file
        const fileContent = await fetch(fileUrl)
        const fileBlob = await fileContent.blob()

        // Upload to Supabase Storage
        const storagePath = `${mediaInfo.file_unique_id}.${filePath.split('.').pop()}`
        const { error: uploadError } = await supabaseClient
          .storage
          .from('telegram-media')
          .upload(storagePath, fileBlob, {
            contentType: mediaInfo.mime_type,
            upsert: true
          })

        if (uploadError) {
          throw uploadError
        }

        // Get public URL
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from('telegram-media')
          .getPublicUrl(storagePath)

        // Add public URL to media info
        mediaInfo.public_url = publicUrl
        mediaInfo.storage_path = storagePath

        return await handleMediaMessage(updateMessage, mediaInfo, {
          isChannelPost,
          isForwarded,
          correlationId,
          isEdit: !!edited_message
        })
      }

      return await handleOtherMessage(updateMessage, {
        isChannelPost,
        isForwarded,
        correlationId,
        isEdit: !!edited_message
      })
    }

    console.log('No processable content in update')
    return new Response(
      JSON.stringify({ message: 'No processable content in update' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing webhook:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
