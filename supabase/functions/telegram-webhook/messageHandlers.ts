
import { supabaseClient } from '../_shared/supabase.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface MessageContext {
  isChannelPost: boolean
  isForwarded: boolean
  correlationId: string
  isEdit: boolean
}

export const handleMediaMessage = async (message: any, mediaInfo: any, context: MessageContext) => {
  try {
    const { isChannelPost, isForwarded, correlationId, isEdit } = context

    // Prepare the message data
    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      message_url: `https://t.me/c/${message.chat.id.toString().slice(4)}/${message.message_id}`,
      media_group_id: message.media_group_id,
      caption: message.caption,
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id,
      mime_type: mediaInfo.mime_type,
      file_size: mediaInfo.file_size,
      width: mediaInfo.width,
      height: mediaInfo.height,
      duration: mediaInfo.duration,
      is_forward: isForwarded,
      forward_from: message.forward_from,
      forward_from_chat: message.forward_from_chat,
      processing_state: 'pending',
      correlation_id: correlationId
    }

    let response
    if (isEdit) {
      // Update existing message
      response = await supabaseClient
        .from('messages')
        .update(messageData)
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
    } else {
      // Insert new message
      response = await supabaseClient
        .from('messages')
        .insert([messageData])
    }

    if (response.error) throw response.error

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error handling media message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}

export const handleOtherMessage = async (message: any, context: MessageContext) => {
  try {
    const { isChannelPost, isForwarded, correlationId, isEdit } = context

    // Store in other_messages table
    const { error } = await supabaseClient
      .from('other_messages')
      .insert([{
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        message_type: isEdit ? 'edited_message' : 'message',
        telegram_data: message,
        correlation_id: correlationId,
        is_forward: isForwarded
      }])

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error handling other message:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
}
