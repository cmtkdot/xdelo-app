
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
  };
  media_group_id?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
    duration: number;
    mime_type: string;
  };
  document?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    mime_type: string;
  };
  caption?: string;
  from?: {
    id: number;
  };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
    if (!WEBHOOK_SECRET) {
      throw new Error('Missing webhook secret');
    }

    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    if (secret !== WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await req.json();
    console.log('Received update:', JSON.stringify(update));

    // Get the message from any possible source
    const message: TelegramMessage = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
    
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract media details
    const photo = message.photo?.[message.photo.length - 1];
    const video = message.video;
    const document = message.document;

    // Get file details from any media type
    const fileId = photo?.file_id || video?.file_id || document?.file_id;
    if (!fileId) {
      console.log('No media found in message');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: message.chat?.id,
      chat_type: message.chat?.type,
      media_group_id: message.media_group_id,
      caption: message.caption || '',
      file_id: fileId,
      file_unique_id: photo?.file_unique_id || video?.file_unique_id || document?.file_unique_id,
      mime_type: document?.mime_type || video?.mime_type || 'image/jpeg',
      file_size: photo?.file_size || video?.file_size || document?.file_size,
      width: photo?.width || video?.width,
      height: photo?.height || video?.height,
      duration: video?.duration,
      telegram_data: message,
      processing_state: message.caption ? 'pending' : 'completed',
      user_id: message.from?.id?.toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Inserting message data:', JSON.stringify(messageData));

    const { error: insertError } = await supabaseClient
      .from('messages')
      .insert(messageData);

    if (insertError) {
      console.error('Error inserting message:', insertError);
      throw insertError;
    }

    // If there's a caption, trigger the AI analysis
    if (message.caption) {
      try {
        await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: { 
            messageId: messageData.telegram_message_id,
            caption: message.caption
          }
        });
      } catch (aiError) {
        console.error('Error triggering AI analysis:', aiError);
        // Don't throw here, we still want to acknowledge the webhook
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
