import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
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

    if (!update.message) {
      console.log('⚠️ No message found in update, creating placeholder file');
      
      const timestamp = new Date().toISOString()
      const uniqueId = crypto.randomUUID()
      const fileName = `placeholder_${timestamp}_${uniqueId}.txt`
      
      const fileContent = new Blob([JSON.stringify(update, null, 2)], { type: 'text/plain' })
      
      console.log('📁 Uploading placeholder file to storage');
      const { error: uploadError } = await supabase.storage
        .from('telegram-media')
        .upload(fileName, fileContent, {
          contentType: 'text/plain',
          upsert: true
        })

      if (uploadError) {
        console.error('❌ Failed to upload placeholder file:', uploadError)
        throw new Error(`Failed to upload placeholder file: ${JSON.stringify(uploadError)}`)
      }

      const publicUrl = `https://ovpsyrhigencvzlxqwqz.supabase.co/storage/v1/object/public/telegram-media/${fileName}`
      console.log('✅ Placeholder file uploaded successfully:', publicUrl)

      return new Response(
        JSON.stringify({ 
          message: 'Created placeholder file for non-message update',
          public_url: publicUrl 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const message = update.message
    console.log('📨 Processing message ID:', message.message_id);

    // Handle photos, videos, and documents
    const mediaItems: TelegramMedia[] = []
    
    if (message.photo) {
      console.log('📸 Found photo array, selecting largest size');
      // For photos, get the highest resolution version (last in array)
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

      // Check for existing media
      console.log('🔍 Checking for existing media with file_unique_id:', mediaItem.file_unique_id);
      const { data: existingMedia } = await supabase
        .from('messages')
        .select('id, public_url')
        .eq('file_unique_id', mediaItem.file_unique_id)
        .single()

      let publicUrl = existingMedia?.public_url

      if (!publicUrl) {
        console.log('📥 No existing media found, downloading from Telegram');
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
        const fileBlob = await fileResponse.blob()
        console.log('✅ File downloaded successfully');

        // Upload to Supabase Storage using file_unique_id as name
        console.log('⬆️ Uploading to Supabase Storage');
        const fileExt = fileInfo.result.file_path.split('.').pop()
        const fileName = `${mediaItem.file_unique_id}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('telegram-media')
          .upload(fileName, fileBlob, {
            contentType: message.video?.mime_type || 'image/jpeg',
            upsert: true
          })

        if (uploadError) {
          console.error('❌ Upload failed:', uploadError);
          throw new Error(`Failed to upload file: ${JSON.stringify(uploadError)}`)
        }
        console.log('✅ File uploaded successfully');

        // Generate public URL
        publicUrl = `https://ovpsyrhigencvzlxqwqz.supabase.co/storage/v1/object/public/telegram-media/${fileName}`
        console.log('🔗 Generated public URL:', publicUrl);
      } else {
        console.log('♻️ Reusing existing public URL:', publicUrl);
      }

      // Store message data
      console.log('💾 Storing message data in database');
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          telegram_message_id: message.message_id,
          media_group_id: message.media_group_id,
          caption: message.caption,
          file_id: mediaItem.file_id,
          file_unique_id: mediaItem.file_unique_id,
          public_url: publicUrl,
          mime_type: message.video?.mime_type || 'image/jpeg',
          file_size: mediaItem.file_size,
          width: mediaItem.width,
          height: mediaItem.height,
          duration: mediaItem.duration,
          user_id: message.from.id.toString(),
          telegram_data: update
        })

      if (messageError) {
        console.error('❌ Failed to store message:', messageError);
        throw new Error(`Failed to store message: ${JSON.stringify(messageError)}`)
      }
      console.log('✅ Message stored successfully');

      processedMedia.push({
        file_unique_id: mediaItem.file_unique_id,
        public_url: publicUrl
      })
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