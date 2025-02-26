
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseClient } from '../_shared/supabase.ts'
import { handleMediaMessage, handleOtherMessage, handleEditedMessage, handleChatMemberUpdate } from './messageHandlers.ts'
import { extractMediaInfo } from './mediaUtils.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { message, edited_message, my_chat_member } = await req.json()
    
    const correlationId = crypto.randomUUID()
    console.log('Received webhook update:', { correlationId, messageType: message?.chat?.type })

    // Log webhook request
    await supabaseClient.from('webhook_logs').insert({
      correlation_id: correlationId,
      request_body: { message, edited_message, my_chat_member },
      timestamp: new Date().toISOString()
    })

    // Handle chat member updates
    if (my_chat_member) {
      console.log('Processing chat member update:', { 
        chat_id: my_chat_member.chat.id,
        chat_type: my_chat_member.chat.type
      })
      return await handleChatMemberUpdate(my_chat_member, correlationId)
    }

    // Handle edited messages
    if (edited_message) {
      console.log('Processing edited message:', {
        message_id: edited_message.message_id,
        chat_id: edited_message.chat.id
      })
      return await handleEditedMessage(edited_message, correlationId)
    }

    // Handle new messages
    if (message) {
      const isChannelPost = message.chat.type === 'channel'
      const isForwarded = message.forward_from || message.forward_from_chat
      
      console.log('Processing message:', {
        message_id: message.message_id,
        chat_id: message.chat.id,
        is_channel_post: isChannelPost,
        is_forwarded: isForwarded,
        has_media: !!message.photo || !!message.video || !!message.document
      })

      // Extract media info if present
      const mediaInfo = await extractMediaInfo(message)

      if (mediaInfo) {
        return await handleMediaMessage(message, mediaInfo, {
          isChannelPost,
          isForwarded,
          correlationId
        })
      }

      return await handleOtherMessage(message, {
        isChannelPost,
        isForwarded,
        correlationId
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
