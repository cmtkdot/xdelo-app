
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const update = await req.json()
    const message = update.message || update.channel_post || update.edited_channel_post || update.edited_message
    
    if (!message) {
      console.error('No message found in update:', update)
      return new Response(JSON.stringify({ error: 'No message found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Handle media messages (photos, videos)
    const photo = message.photo ? message.photo[message.photo.length - 1] : null
    const video = message.video
    const media = photo || video

    if (media) {
      console.log('Processing media message:', media)

      // Get the existing message if this is an edit
      let existingMedia = null
      if (message.edit_date) {
        const { data: existing } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('chat_id', message.chat.id)
          .eq('telegram_message_id', message.message_id)
          .single()
        
        existingMedia = existing
      }

      // Prepare message data
      const messageData = {
        chat_id: message.chat.id,
        chat_type: message.chat.type,
        chat_title: message.chat.title,
        telegram_message_id: message.message_id,
        media_group_id: message.media_group_id,
        caption: message.caption,
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: video ? video.mime_type : 'image/jpeg',
        file_size: media.file_size,
        width: media.width,
        height: media.height,
        duration: video?.duration,
        is_edited: Boolean(message.edit_date),
        edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
        processing_state: message.caption ? 'pending' : 'initialized',
        telegram_data: { message }
      }

      // For edits, update existing record
      if (existingMedia) {
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update(messageData)
          .eq('id', existingMedia.id)

        if (updateError) throw updateError
      } 
      // For new messages, insert
      else {
        const { error: insertError } = await supabaseClient
          .from('messages')
          .insert([messageData])

        if (insertError) throw insertError
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Handle non-media messages
    const nonMediaMessage = {
      chat_id: message.chat.id,
      chat_type: message.chat.type,
      chat_title: message.chat.title,
      telegram_message_id: message.message_id,
      message_type: 'text',
      message_text: message.text,
      is_edited: Boolean(message.edit_date),
      edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : null,
      telegram_data: { message }
    }

    const { error: textError } = await supabaseClient
      .from('other_messages')
      .upsert([nonMediaMessage], { onConflict: 'chat_id,telegram_message_id' })

    if (textError) throw textError

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
