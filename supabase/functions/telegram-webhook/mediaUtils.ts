
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { logMessageOperation } from './logger.ts';

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

  // Check if file already exists in the database
  const { data: existingFile } = await supabase
    .from('messages')
    .select('file_unique_id, storage_path, public_url')
    .eq('file_unique_id', media.file_unique_id)
    .limit(1)

  // If we already have this file, return the existing information
  if (existingFile && existingFile.length > 0) {
    console.log(`Duplicate file detected: ${media.file_unique_id}, reusing existing file information`)
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
      storage_path: existingFile[0].storage_path,
      public_url: existingFile[0].public_url
    }
  }

  // Get file info from Telegram
  const fileInfo = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${media.file_id}`
  ).then(res => res.json())

  if (!fileInfo.ok) throw new Error('Failed to get file info from Telegram')

  // Download file from Telegram
  const fileData = await fetch(
    `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
  ).then(res => res.blob())

  // Get mime type and extension
  const mimeType = video ? (video.mime_type || 'video/mp4') :
                document ? (document.mime_type || 'application/octet-stream') :
                'image/jpeg'
  
  const extension = mimeType.split('/')[1]
  const fileName = `${media.file_unique_id}.${extension}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase
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
}
