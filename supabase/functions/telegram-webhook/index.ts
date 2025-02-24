
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Database } from "../_shared/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookLog {
  event_type: string;
  event_message?: string;
  correlation_id: string;
  metadata?: any;
  created_at?: string;
}

type ProcessingState = Database['public']['Enums']['processing_state_type'];
type TelegramChatType = Database['public']['Enums']['telegram_chat_type'];

async function logWebhookEvent(supabase: any, log: WebhookLog) {
  const { error } = await supabase
    .from('webhook_logs')
    .insert({
      ...log,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error logging webhook event:', error);
  }
}

async function handleMediaMessage(message: any, supabase: any, correlationId: string) {
  const photos = message.photo || [];
  const video = message.video;
  const document = message.document;
  
  let mediaType: 'photo' | 'video' | 'document' | null = null;
  let fileId = null;
  let fileUniqueId = null;
  let mimeType = null;
  let fileSize = null;
  let width = null;
  let height = null;
  let duration = null;
  
  if (photos.length > 0) {
    const photo = photos[photos.length - 1]; // Get the highest quality photo
    mediaType = 'photo';
    fileId = photo.file_id;
    fileUniqueId = photo.file_unique_id;
    width = photo.width;
    height = photo.height;
  } else if (video) {
    mediaType = 'video';
    fileId = video.file_id;
    fileUniqueId = video.file_unique_id;
    mimeType = video.mime_type;
    fileSize = video.file_size;
    width = video.width;
    height = video.height;
    duration = video.duration;
  } else if (document) {
    mediaType = 'document';
    fileId = document.file_id;
    fileUniqueId = document.file_unique_id;
    mimeType = document.mime_type;
    fileSize = document.file_size;
  }

  if (!fileId || !fileUniqueId) {
    throw new Error('No valid media found in message');
  }

  const { error } = await supabase
    .from('messages')
    .insert({
      file_id: fileId,
      file_unique_id: fileUniqueId,
      mime_type: mimeType,
      file_size: fileSize,
      width,
      height,
      duration,
      media_type: mediaType,
      caption: message.caption,
      media_group_id: message.media_group_id,
      telegram_message_id: message.message_id,
      chat_id: message.chat.id,
      chat_type: message.chat.type as TelegramChatType,
      chat_title: message.chat.title,
      telegram_data: message,
      processing_state: 'initialized' as ProcessingState,
      correlation_id: correlationId,
      is_channel: message.chat.type === 'channel',
    });

  if (error) {
    throw error;
  }
}

async function handleEditedMessage(message: any, supabase: any, correlationId: string) {
  const { error } = await supabase
    .from('messages')
    .update({
      caption: message.caption,
      telegram_data: message,
      is_edited: true,
      updated_at: new Date().toISOString(),
      processing_state: 'pending' as ProcessingState,
    })
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id);

  if (error) {
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();

  try {
    const update = await req.json();
    
    const message = update.message || 
                   update.channel_post || 
                   update.edited_message || 
                   update.edited_channel_post;

    if (!message) {
      await logWebhookEvent({
        event_type: 'no_message',
        correlation_id: correlationId,
        metadata: { update_keys: Object.keys(update) }
      });
      return new Response(
        JSON.stringify({ success: false, message: 'No message to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Log the incoming webhook
    await logWebhookEvent(supabase, {
      event_type: 'webhook_received',
      correlation_id: correlationId,
      metadata: {
        message_id: message.message_id,
        chat_id: message.chat?.id,
        update_id: update.update_id
      }
    });

    if (update.edited_message || update.edited_channel_post) {
      await handleEditedMessage(message, supabase, correlationId);
    } else if (message.photo || message.video || message.document) {
      await handleMediaMessage(message, supabase, correlationId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    await logWebhookEvent({
      event_type: 'error',
      event_message: error.message,
      correlation_id: correlationId,
      metadata: { error_stack: error.stack }
    });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
