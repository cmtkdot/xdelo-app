
import { serve } from "http/server"
import { createClient } from "supabase"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

if (!supabaseUrl || !supabaseServiceRole || !telegramToken) {
  throw new Error('Missing environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceRole)

async function logWebhookEvent(eventType: string, chatId: number | null, messageId: number | null, mediaType: string | null = null, errorMessage: string | null = null, rawData: any = null) {
  try {
    const { error } = await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: eventType,
      p_chat_id: chatId,
      p_message_id: messageId,
      p_media_type: mediaType,
      p_error_message: errorMessage,
      p_raw_data: rawData
    });
    
    if (error) {
      console.error('Error logging webhook event:', error);
    }
  } catch (err) {
    console.error('Failed to log webhook event:', err);
  }
}

async function getFileUrl(fileId: string): Promise<string> {
  try {
    console.log('Getting file URL for fileId:', fileId);
    const response = await fetch(
      `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      throw new Error(`Telegram API error: ${error}`);
    }

    const data = await response.json();
    
    if (!data.ok || !data.result?.file_path) {
      console.error('Invalid response from Telegram:', data);
      throw new Error('Invalid response from Telegram API');
    }

    return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`;
  } catch (error) {
    console.error('Error in getFileUrl:', error);
    throw error;
  }
}

async function uploadMediaToStorage(fileUrl: string, fileUniqueId: string, mimeType: string): Promise<string> {
  console.log('Uploading media to storage', { fileUniqueId, mimeType });
  
  const ext = mimeType.split('/')[1] || 'bin';
  const storagePath = `${fileUniqueId}.${ext}`;
  
  try {
    // Check if file already exists
    const { data: existingFiles } = await supabase
      .storage
      .from('telegram-media')
      .list('', { 
        search: storagePath,
        limit: 1
      });

    if (existingFiles && existingFiles.length > 0) {
      const { data: { publicUrl } } = supabase
        .storage
        .from('telegram-media')
        .getPublicUrl(storagePath);
      
      console.log('File already exists, returning existing URL');
      return publicUrl;
    }

    // Download media from Telegram
    const mediaResponse = await fetch(fileUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.statusText}`);
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer();

    // Upload to storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    console.log('Successfully uploaded media to storage');
    return publicUrl;

  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  console.log(`[${correlationId}] Processing webhook request`);

  try {
    const rawBody = await req.text();
    let update;

    try {
      update = JSON.parse(rawBody);
      console.log(`[${correlationId}] Received update:`, update);
    } catch (e) {
      console.error(`[${correlationId}] Failed to parse JSON:`, e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the message object (regular or edited)
    const message = update.message || update.edited_message || 
                   update.channel_post || update.edited_channel_post;

    if (!message) {
      console.log(`[${correlationId}] No valid message in update`);
      return new Response(
        JSON.stringify({ status: 'ignored', reason: 'no valid message' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isEdit = !!update.edited_message || !!update.edited_channel_post;
    const chat = message.chat;
    
    // Handle text messages
    if (!message.photo && !message.video && !message.document) {
      console.log(`[${correlationId}] Processing text message`);
      
      await logWebhookEvent(
        'text_message_received',
        chat.id,
        message.message_id,
        'text',
        null,
        update
      );

      const { error: insertError } = await supabase
        .from('other_messages')
        .insert({
          chat_id: chat.id,
          chat_type: chat.type,
          chat_title: chat.title,
          telegram_message_id: message.message_id,
          message_text: message.text,
          telegram_data: update,
          correlation_id: correlationId
        });

      if (insertError) {
        throw insertError;
      }

      return new Response(
        JSON.stringify({ 
          status: 'success',
          type: 'text_message',
          correlation_id: correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle media messages
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    if (!media) {
      console.log(`[${correlationId}] No supported media found`);
      return new Response(
        JSON.stringify({ 
          status: 'ignored',
          reason: 'no supported media',
          correlation_id: correlationId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing media
    const { data: existingMedia } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single();

    // Get file URL and upload to storage
    const telegramFileUrl = await getFileUrl(media.file_id);
    const storageUrl = await uploadMediaToStorage(
      telegramFileUrl,
      media.file_unique_id,
      video ? video.mime_type : 'image/jpeg'
    );

    const messageData = {
      telegram_message_id: message.message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: message.media_group_id,
      caption: message.caption || '',
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: storageUrl,
      mime_type: video ? video.mime_type : 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      processing_state: message.caption ? 'pending' : 'initialized',
      telegram_data: update,
      correlation_id: correlationId,
      is_edited: isEdit,
      edit_date: isEdit ? new Date(message.edit_date * 1000).toISOString() : null
    };

    let resultMessage;

    if (existingMedia) {
      console.log(`[${correlationId}] Updating existing media message`);
      const { data: updated, error: updateError } = await supabase
        .from('messages')
        .update(messageData)
        .eq('id', existingMedia.id)
        .select()
        .single();

      if (updateError) throw updateError;
      resultMessage = updated;

    } else {
      console.log(`[${correlationId}] Inserting new media message`);
      const { data: inserted, error: insertError } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertError) throw insertError;
      resultMessage = inserted;
    }

    // Trigger caption analysis if needed
    if (message.caption) {
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: {
          messageId: resultMessage.id,
          caption: message.caption,
          correlation_id: correlationId,
          is_edit: isEdit,
          media_group_id: message.media_group_id
        }
      });
    }

    await logWebhookEvent(
      'media_message_processed',
      chat.id,
      message.message_id,
      video ? 'video' : 'photo',
      null,
      { messageId: resultMessage.id }
    );

    return new Response(
      JSON.stringify({
        status: 'success',
        message_id: resultMessage.id,
        correlation_id: correlationId,
        is_edit: isEdit,
        has_caption: !!message.caption
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error processing webhook:`, error);

    await logWebhookEvent(
      'webhook_error',
      null,
      null,
      null,
      error.message,
      { stack: error.stack }
    );

    return new Response(
      JSON.stringify({
        status: 'error',
        message: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
