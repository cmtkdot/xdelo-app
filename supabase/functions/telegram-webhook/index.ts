
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleMediaMessage, handleOtherMessage } from './handlers/messageHandler.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Generate correlation ID for this request
    const correlationId = crypto.randomUUID()
    console.log(`Processing update with correlation ID: ${correlationId}`)
    console.log(`Webhook received: ${new Date().toISOString()}`)

    const update = await req.json()

    // Get the message object, checking for different types of updates
    const message = update.message || update.edited_message || update.channel_post || update.edited_channel_post
    if (!message) {
      console.log('No processable content in update')
      return new Response(JSON.stringify({ message: "No processable content" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Determine message context
    const context = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post
    }

    // Handle media messages (photos, videos, documents)
    if (message.photo || message.video || message.document) {
      return await handleMediaMessage(message, context);
    }

    // Handle other types of messages
    return await handleOtherMessage(message, context)

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
