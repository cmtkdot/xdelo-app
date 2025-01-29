import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { determineMediaType, uploadMedia, type MediaFileMetadata } from './mediaUtils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fixed user_id for bot operations
const BOT_USER_ID = 'f1cdf0f8-082b-4b10-a949-2e0ba7f84db7';

interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  mime_type?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
    };
    date: number;
    media_group_id?: string;
    caption?: string;
    photo?: TelegramMedia[];
    video?: TelegramMedia;
    document?: TelegramMedia;
  };
  channel_post?: {
    message_id: number;
    sender_chat: {
      id: number;
      title: string;
      type: string;
    };
    chat: {
      id: number;
      title: string;
      type: string;
    };
    date: number;
    media_group_id?: string;
    caption?: string;
    photo?: TelegramMedia[];
    video?: TelegramMedia;
    document?: TelegramMedia;
  };
}

serve(async (req) => {
  console.log('🚀 Webhook handler started');
  
  if (req.method === 'OPTIONS') {
    console.log('👋 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔑 Checking for TELEGRAM_BOT_TOKEN');
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set')
    }

    console.log('🔌 Initializing Supabase client');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const rawBody = await req.text()
    console.log('📩 Received webhook payload:', rawBody)

    let update: TelegramUpdate
    try {
      console.log('🔄 Parsing JSON payload');
      update = JSON.parse(rawBody)
    } catch (error) {
      console.error('❌ Failed to parse JSON:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('📝 Processing update:', JSON.stringify(update, null, 2))

    const message = update.message || update.channel_post
    if (!message) {
      console.error('❌ No message or channel_post found in update')
      return new Response(
        JSON.stringify({ error: 'No message or channel_post found in update' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('📨 Processing message ID:', message.message_id);

    const mediaItems: TelegramMedia[] = []
    
    if (message.photo) {
      console.log('📸 Found photo array, selecting largest size');
      mediaItems.push(message.photo[message.photo.length - 1])
    }
    if (message.video) {
      console.log('🎥 Found video');
      mediaItems.push(message.video)
    }
    if (message.document) {
      console.log('📄 Found document');
      mediaItems.push(message.document)
    }

    console.log(`🖼️ Processing ${mediaItems.length} media items`);

    const processedMedia = []
    for (const mediaItem of mediaItems) {
      console.log('🔍 Processing media item:', mediaItem.file_unique_id);

      // Check if file already exists in messages table
      const { data: existingMessage } = await supabase
        .from('messages')
        .select('*')
        .eq('file_unique_id', mediaItem.file_unique_id)
        .single();

      let uploadResult;
      if (existingMessage?.public_url) {
        console.log('✅ Found existing file, reusing public URL:', existingMessage.public_url);
        uploadResult = {
          publicUrl: existingMessage.public_url,
          fileName: `${mediaItem.file_unique_id}.${mediaItem.mime_type?.split('/')[1]}`,
          mimeType: mediaItem.mime_type || 'application/octet-stream'
        };
        
        // Update existing message with new telegram data
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            telegram_data: update,
            caption: message.caption || '', // Store empty string for messages without caption
            media_group_id: message.media_group_id,
            telegram_message_id: message.message_id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMessage.id);

        if (updateError) {
          console.error('❌ Failed to update existing message:', updateError);
          throw updateError;
        }
        console.log('✅ Updated existing message with new telegram data');
      } else {
        // Get file info from Telegram
        const fileInfoResponse = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${mediaItem.file_id}`
        )
        const fileInfo = await fileInfoResponse.json()
        console.log('📄 File info from Telegram:', JSON.stringify(fileInfo, null, 2));

        if (!fileInfo.ok) {
          throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`)
        }

        // Download file from Telegram
        console.log('⬇️ Downloading file from Telegram');
        const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
        const fileResponse = await fetch(fileUrl)
        const fileBuffer = await fileResponse.arrayBuffer()
        console.log('✅ File downloaded successfully');

        // Prepare metadata for upload
        const metadata: MediaFileMetadata = {
          fileUniqueId: mediaItem.file_unique_id,
          fileType: determineMediaType(mediaItem.mime_type),
          mimeType: mediaItem.mime_type,
          fileSize: mediaItem.file_size,
          width: mediaItem.width,
          height: mediaItem.height,
          duration: mediaItem.duration
        }

        // Upload using the media utilities
        uploadResult = await uploadMedia(supabase, fileBuffer, metadata)
        console.log('✅ File uploaded successfully');

        // Store new message data
        console.log('💾 Storing new message data in database');
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            telegram_message_id: message.message_id,
            media_group_id: message.media_group_id,
            caption: message.caption || '', // Store empty string for messages without caption
            file_id: mediaItem.file_id,
            file_unique_id: mediaItem.file_unique_id,
            public_url: uploadResult.publicUrl,
            mime_type: mediaItem.mime_type,
            file_size: mediaItem.file_size,
            width: mediaItem.width,
            height: mediaItem.height,
            duration: mediaItem.duration,
            user_id: BOT_USER_ID,
            telegram_data: update,
            is_original_caption: false // Will be updated by the trigger if needed
          });

        if (messageError) {
          console.error('❌ Failed to store message:', messageError);
          throw messageError;
        }
        console.log('✅ Message stored successfully');
      }

      processedMedia.push({
        file_unique_id: mediaItem.file_unique_id,
        public_url: uploadResult.publicUrl
      });
    }

    console.log('🎉 Webhook processing completed successfully');
    return new Response(
      JSON.stringify({ 
        message: 'Successfully processed media message',
        processed_media: processedMedia
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error processing update:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})