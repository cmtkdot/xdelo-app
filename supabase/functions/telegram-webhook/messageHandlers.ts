
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

    console.log('Message data extracted:', {
      message_id: message.message_id,
      chat_id: message.chat.id,
      media_group_id: message.media_group_id,
      has_photo: !!message.photo,
      has_video: !!message.video,
      has_caption: !!message.caption
    })

    console.log('Processing media message:', {
      file_unique_id: mediaInfo.file_unique_id,
      media_type: message.photo ? 'photo' : message.video ? 'video' : 'document',
      storage_path: `${mediaInfo.file_unique_id}.${mediaInfo.mime_type.split('/')[1]}`
    })

    console.log('Attempting to insert message...')

    // First check if message already exists
    const { data: existingMessage } = await supabaseClient
      .from('messages')
      .select('id, processing_state, analyzed_content')
      .eq('telegram_message_id', message.message_id)
      .eq('chat_id', message.chat.id)
      .maybeSingle()

    if (existingMessage) {
      console.log('Found existing message:', {
        id: existingMessage.id,
        current_state: existingMessage.processing_state,
        has_analyzed_content: !!existingMessage.analyzed_content
      })

      console.log('Duplicate message detected, handling update flow...')

      if (message.caption !== undefined) {
        console.log('Changes detected, updating message and triggering reanalysis')
        console.log('Caption changed, triggering AI analysis')
      }

      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          caption: message.caption,
          is_edited: true,
          edit_date: new Date().toISOString(),
          processing_state: 'pending',
          telegram_data: message,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id)

      if (updateError) throw updateError

      if (message.caption) {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: existingMessage.id,
            caption: message.caption,
            correlationId
          }
        })
      }
    } else {
      // Prepare new message data
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
        processing_state: message.caption ? 'pending' : 'initialized',
        telegram_data: message,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Set group metadata if part of media group
        ...(message.media_group_id ? {
          group_first_message_time: new Date().toISOString(),
          is_original_caption: !!message.caption,
          group_caption_synced: false
        } : {})
      }

      const { error: insertError, data: insertedMessage } = await supabaseClient
        .from('messages')
        .insert([messageData])
        .select()
        .single()

      if (insertError) throw insertError

      if (message.caption) {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: insertedMessage.id,
            caption: message.caption,
            correlationId
          }
        })
      }
    }

    console.log('Webhook processing completed successfully')

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

    console.log('Webhook processing completed successfully')

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
