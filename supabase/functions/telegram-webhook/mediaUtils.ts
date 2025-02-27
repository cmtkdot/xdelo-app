
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

// Create Supabase client with storage capabilities
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export const getMediaInfo = async (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document
  
  const media = photo || video || document
  if (!media) throw new Error('No media found in message')

  try {
    // Get file info from Telegram with better error handling
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${media.file_id}`
    )
    
    if (!fileInfoResponse.ok) {
      const errorData = await fileInfoResponse.json()
      throw new Error(`Telegram API error: ${errorData.description || fileInfoResponse.statusText}`)
    }

    const fileInfo = await fileInfoResponse.json()

    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      console.error('Invalid file info response:', JSON.stringify(fileInfo))
      throw new Error('Invalid file info response from Telegram')
    }

    // Download file from Telegram with better error handling
    const fileResponse = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    )
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${fileResponse.statusText}`)
    }

    const fileData = await fileResponse.blob()

    // Get mime type and extension
    const mimeType = video ? (video.mime_type || 'video/mp4') :
                    document ? (document.mime_type || 'application/octet-stream') :
                    'image/jpeg'
    
    const extension = mimeType.split('/')[1]
    const fileName = `${media.file_unique_id}.${extension}`

    // Upload to Supabase Storage with better error handling
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, fileData, {
        contentType: mimeType,
        upsert: true
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`)
    }

    // Get public URL - matches the trigger-generated URL format
    const publicUrl = `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${fileName}`

    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl
    }
  } catch (error) {
    // Enhanced error logging
    console.error('Media processing error:', error.message)
    
    // Return minimal info when media processing fails
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: video ? (video.mime_type || 'video/mp4') :
                document ? (document.mime_type || 'application/octet-stream') :
                'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: null,
      public_url: null,
      processing_error: error.message
    }
  }
}
