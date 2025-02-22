
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { corsHeaders } from './authUtils.ts';

const logWebhookEvent = async (supabase: any, event: any, messageId?: string) => {
  try {
    await supabase.from('webhook_logs').insert({
      event_type: 'webhook_received',
      raw_data: event,
      correlation_id: crypto.randomUUID(),
      message_id: messageId // Now expects a UUID
    });
  } catch (error) {
    console.error('Error logging webhook event:', error);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const update = await req.json();
    console.log('📥 Received webhook update:', JSON.stringify(update, null, 2));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const correlationId = crypto.randomUUID();
    
    const message = update.message || update.channel_post || update.edited_message;
    if (!message) {
      console.log('❌ No message in update. Update keys:', Object.keys(update));
      await logWebhookEvent(supabase, update);
      return new Response(
        JSON.stringify({ status: 'skipped', reason: 'no message found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    // Check for media content
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const media = photo || video;

    if (!media) {
      console.log('📝 Processing non-media message:', message.message_id);
      
      // Determine message type
      let messageType = 'text';
      if (message.text?.startsWith('/')) messageType = 'command';
      else if (message.sticker) messageType = 'sticker';
      else if (message.voice) messageType = 'voice';
      else if (message.document) messageType = 'document';
      else if (message.location) messageType = 'location';
      else if (message.contact) messageType = 'contact';
      else if (message.poll) messageType = 'poll';
      else if (message.venue) messageType = 'venue';
      else if (message.game) messageType = 'game';
      else if (message.invoice) messageType = 'invoice';

      // Insert into other_messages
      const { data: insertedMessage, error: insertError } = await supabase
        .from('other_messages')
        .insert({
          telegram_message_id: message.message_id,
          chat_id: message.chat.id,
          chat_type: message.chat.type,
          chat_title: message.chat.title,
          message_type: messageType,
          message_text: message.text || '',
          is_channel_post: !!update.channel_post,
          sender_chat_id: message.sender_chat?.id,
          is_edited: !!update.edited_message,
          edit_date: update.edited_message ? new Date(update.edited_message.edit_date * 1000).toISOString() : null,
          telegram_data: update,
          processing_state: 'completed',
          processing_correlation_id: correlationId,
          processing_completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error inserting other_message:', insertError);
        throw insertError;
      }

      // Log the webhook event with the new message UUID
      await logWebhookEvent(supabase, update, insertedMessage.id);

      return new Response(
        JSON.stringify({ 
          status: 'success', 
          message: 'Non-media message processed',
          type: messageType,
          id: insertedMessage.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!supabaseUrl || !supabaseServiceRole || !telegramToken) {
      throw new Error('Missing environment variables')
    }

    async function getFileUrl(fileId: string): Promise<string> {
      console.log('🔍 Getting file URL for fileId:', fileId)
      const response = await fetch(
        `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
      )
      const data = await response.json()
      if (!data.ok) throw new Error('Failed to get file path')
      return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`
    }

    async function uploadMediaToStorage(fileUrl: string, fileUniqueId: string, mimeType: string): Promise<string> {
      console.log('📤 Uploading media to storage:', { fileUniqueId, mimeType })
      
      const ext = mimeType.split('/')[1] || 'bin'
      const storagePath = `${fileUniqueId}.${ext}`
      
      try {
        const mediaResponse = await fetch(fileUrl)
        if (!mediaResponse.ok) throw new Error('Failed to download media from Telegram')
        
        const mediaBuffer = await mediaResponse.arrayBuffer()

        const { error: uploadError } = await supabase
          .storage
          .from('telegram-media')
          .upload(storagePath, mediaBuffer, {
            contentType: mimeType,
            upsert: true
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase
          .storage
          .from('telegram-media')
          .getPublicUrl(storagePath)

        console.log('✅ Media uploaded successfully:', publicUrl)
        return publicUrl

      } catch (error) {
        console.error('❌ Error uploading media:', error)
        throw error
      }
    }

    console.log('📨 Message content:', JSON.stringify(message, null, 2));

    const chat = message.chat
    const mediaGroupId = message.media_group_id
    const photo = message.photo ? message.photo[message.photo.length - 1] : null
    const video = message.video
    const media = photo || video

    console.log('📸 Media details:', {
      hasPhoto: !!photo,
      hasVideo: !!video,
      mediaGroupId,
      mediaObject: media
    });

    const { data: existingMedia, error: queryError } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', media.file_unique_id)
      .single()

    if (queryError) {
      console.error('❌ Error checking existing media:', queryError);
    }

    console.log('🔍 Existing media check:', {
      exists: !!existingMedia,
      fileUniqueId: media.file_unique_id
    });

    let messageData = existingMedia;
    let storageUrl = existingMedia?.public_url;

    // Always process media updates
    console.log('🔄 Processing media update');
    
    const telegramFileUrl = await getFileUrl(media.file_id)
    console.log('📥 Got Telegram file URL:', telegramFileUrl);
    
    if (!existingMedia) {
      console.log('📤 New media detected, uploading to storage');
      storageUrl = await uploadMediaToStorage(
        telegramFileUrl,
        media.file_unique_id,
        video ? video.mime_type : 'image/jpeg'
      )
    } else {
      console.log('♻️ Using existing storage URL:', storageUrl);
    }
      
    const newMessageData: {
      telegram_message_id: number;
      chat_id: number;
      chat_type: string;
      chat_title: string;
      media_group_id?: string;
      caption: string;
      file_id: string;
      file_unique_id: string;
      public_url?: string;
      storage_path: string;
      mime_type: string;
      file_size?: number;
      width: number;
      height: number;
      duration?: number;
      processing_state: string;
      telegram_data: Record<string, unknown>;
      is_edited?: boolean;
      edit_date?: string;
      analyzed_content?: Record<string, unknown> | null;
    } = {
      telegram_message_id: message.message_id,
      chat_id: chat.id,
      chat_type: chat.type,
      chat_title: chat.title,
      media_group_id: mediaGroupId,
      caption: message.caption || '', // Store empty string if no caption
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      public_url: storageUrl,
      storage_path: `${media.file_unique_id}.${video ? video.mime_type.split('/')[1] : 'jpeg'}`,
      mime_type: video ? video.mime_type : 'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      processing_state: message.caption ? 'pending' : 'initialized',
      telegram_data: update
    }

    // Handle edited messages
    if (message.edit_date) {
      newMessageData.is_edited = true;
      newMessageData.edit_date = new Date(message.edit_date * 1000).toISOString();
      newMessageData.analyzed_content = null; // Clear for re-analysis
      newMessageData.processing_state = message.caption ? 'pending' : 'initialized';
      if (existingMedia?.telegram_data) {
        newMessageData.telegram_data = {
          original_message: existingMedia.telegram_data.message,
          edited_message: message
        };
      }
    }

    console.log('📝 Prepared message data:', JSON.stringify(newMessageData, null, 2));

    if (existingMedia) {
      console.log('🔄 Updating existing media');
      const { data: updatedMessage, error } = await supabase
        .from('messages')
        .update(newMessageData)
        .eq('id', existingMedia.id)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error updating message:', error);
        throw error;
      }
      messageData = updatedMessage;
    } else {
      console.log('📥 Inserting new media');
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert(newMessageData)
        .select()
        .single();
        
      if (error) {
        console.error('❌ Error inserting message:', error);
        throw error;
      }
      messageData = newMessage;
    }

    // Only trigger analysis if there's a caption
    if (message.caption) {
      console.log('🔄 Triggering caption analysis for message:', messageData.id);
      await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: messageData.id,
          caption: message.caption
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        status: 'success', 
        message: 'Message processed',
        messageId: messageData.id,
        storagePath: messageData.storage_path
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
    )

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
