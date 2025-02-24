
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text();
    console.log('📝 Raw request body:', rawBody);

    let update;
    try {
      update = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e);
      return new Response(
        JSON.stringify({ status: 'error', reason: 'invalid json' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('📥 Parsed webhook update:', JSON.stringify(update, null, 2));

    // Handle both regular messages and channel posts
    const message = update.message || update.channel_post;
    
    if (!message) {
      console.log('❌ No message or channel_post in update. Update keys:', Object.keys(update));
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'no message or channel_post',
          update_keys: Object.keys(update)
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      );
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

    if (!media) {
      console.log('❌ No media in message. Message type:', message.type);
      return new Response(
        JSON.stringify({ 
          status: 'skipped', 
          reason: 'no media',
          messageType: message.type 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }}
      )
    }

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
        message: error.message,
        stack: error.stack 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
