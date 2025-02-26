
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

export const getMediaInfo = async (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document
  
  const media = photo || video || document
  if (!media) throw new Error('No media found in message')

  return {
    file_id: media.file_id,
    file_unique_id: media.file_unique_id,
    mime_type: video ? video.mime_type : document ? document.mime_type : 'image/jpeg',
    file_size: media.file_size,
    width: media.width,
    height: media.height,
    duration: video?.duration,
    storage_path: `${media.file_unique_id}.${video ? video.mime_type.split('/')[1] : 'jpeg'}`,
    public_url: `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${media.file_unique_id}.${video ? video.mime_type.split('/')[1] : 'jpeg'}`
  }
}
