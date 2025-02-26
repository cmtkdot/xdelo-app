
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

    // Prepare the message data with proper processing state
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
      public_url: mediaInfo.public_url,
      storage_path: mediaInfo.storage_path,
      is_forward: isForwarded,
      forward_from: message.forward_from,
      forward_from_chat: message.forward_from_chat,
      is_edited: isEdit,
      processing_state: message.caption ? 'pending' : 'initialized',
      processing_started_at: new Date().toISOString(),
      correlation_id: correlationId,
      telegram_data: message,
      // Set group metadata if part of media group
      ...(message.media_group_id ? {
        group_first_message_time: new Date().toISOString(),
        is_original_caption: !!message.caption,
        group_caption_synced: false
      } : {})
    }

    let response
    if (isEdit) {
      // Update existing message
      response = await supabaseClient
        .from('messages')
        .update({
          ...messageData,
          edit_date: new Date().toISOString(),
          edit_count: supabaseClient.rpc('increment_edit_count', { msg_id: message.message_id })
        })
        .eq('telegram_message_id', message.message_id)
        .eq('chat_id', message.chat.id)
    } else {
      // Insert new message
      response = await supabaseClient
        .from('messages')
        .insert([messageData])
    }

    if (response.error) throw response.error

    // If has caption, trigger manual parsing
    if (message.caption) {
      await supabaseClient.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: response.data[0].id,
          caption: message.caption,
          correlationId
        }
      })
    } 
    // If part of media group but no caption, check for existing analyzed content
    else if (message.media_group_id) {
      const { data: groupMessages } = await supabaseClient
        .from('messages')
        .select('analyzed_content')
        .eq('media_group_id', message.media_group_id)
        .not('analyzed_content', 'is', null)
        .limit(1)

      if (groupMessages?.length > 0) {
        await supabaseClient
          .from('messages')
          .update({
            analyzed_content: groupMessages[0].analyzed_content,
            processing_state: 'completed',
            group_caption_synced: true
          })
          .eq('id', response.data[0].id)
      }
    }

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
        is_forward: isForwarded,
        message_text: message.text,
        processing_state: 'completed',
        created_at: new Date().toISOString()
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
