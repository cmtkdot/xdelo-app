
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts';

const createSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!WEBHOOK_SECRET) {
      throw new Error('Missing webhook secret');
    }

    // Verify webhook secret
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    if (secret !== WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await req.json();
    console.log('Received update:', JSON.stringify(update));

    // Get the message from any possible source
    const message = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
    
    if (!message) {
      // Just log and return success for any non-message updates
      console.log('Non-message update received:', update);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const messageData = {
      message_id: message.message_id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.type,
      media_group_id: message.media_group_id,
      caption: message.caption || '',
      file_id: message.photo?.[message.photo.length - 1]?.file_id || message.document?.file_id || message.video?.file_id,
      file_unique_id: message.photo?.[message.photo.length - 1]?.file_unique_id || message.document?.file_unique_id || message.video?.file_unique_id,
      mime_type: message.document?.mime_type || message.video?.mime_type || 'image/jpeg',
      telegram_data: message
    };

    // Only process messages with media
    if (messageData.file_id) {
      console.log('Processing message:', messageData);
      const supabase = createSupabaseClient();

      const { data: existingMessage, error: checkError } = await supabase
        .from('messages')
        .select('id, processing_state')
        .eq('message_id', messageData.message_id)
        .eq('chat_id', messageData.chat_id)
        .single();

      if (existingMessage) {
        // Update existing message
        await supabase
          .from('messages')
          .update({
            caption: messageData.caption,
            telegram_data: messageData.telegram_data,
            processing_state: 'pending'
          })
          .eq('id', existingMessage.id);
      } else {
        // Insert new message
        await supabase
          .from('messages')
          .insert({
            ...messageData,
            processing_state: messageData.caption ? 'pending' : 'completed'
          });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in webhook handler:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
