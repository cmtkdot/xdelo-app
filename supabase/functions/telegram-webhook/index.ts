
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
    const updateMessage = edited_message || message // Use edited_message if available, otherwise use message
    
    const correlationId = crypto.randomUUID()
    console.log('Received webhook update:', { 
      correlationId, 
      messageType: updateMessage?.chat?.type,
      isEdit: !!edited_message
    })

    // Log webhook request
    await supabaseClient.from('webhook_logs').insert({
      correlation_id: correlationId,
      request_body: { message, edited_message },
      timestamp: new Date().toISOString()
    })

    // Process message (whether new or edited)
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
      const mediaInfo = await extractMediaInfo(updateMessage)

      if (mediaInfo) {
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
    
    // Log error to webhook_logs
    await supabaseClient.from('webhook_logs').insert({
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
