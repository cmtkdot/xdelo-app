
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TelegramMessage, MediaInfo } from '../_shared/types.ts';
import { getLogger } from './logger.ts';

export function extractMediaInfo(message: TelegramMessage): MediaInfo | null {
  if (message.photo) {
    const photo = message.photo[message.photo.length - 1];
    return {
      file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      mime_type: 'image/jpeg',
      width: photo.width,
      height: photo.height,
      file_size: photo.file_size
    };
  } 
  
  if (message.video) {
    return {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      mime_type: message.video.mime_type || 'video/mp4',
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      file_size: message.video.file_size
    };
  }
  
  return null;
}

export async function downloadAndStoreMedia(
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
): Promise<{
  success: boolean;
  error?: string;
  publicUrl?: string;
  storagePath?: string;
}> {
  const logger = getLogger(correlationId);
  
  try {
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      logger.error('No media found in message', { message_id: message.message_id });
      return { success: false, error: 'No media found in message' };
    }

    // Get media URL from Telegram
    const fileResponse = await fetch(
      `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/getFile?file_id=${mediaInfo.file_id}`
    );
    
    const fileData = await fileResponse.json();
    if (!fileData.ok || !fileData.result.file_path) {
      throw new Error('Failed to get file path from Telegram');
    }

    const fileUrl = `https://api.telegram.org/file/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/${fileData.result.file_path}`;
    const mediaResponse = await fetch(fileUrl);
    
    if (!mediaResponse.ok) {
      throw new Error('Failed to download media from Telegram');
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();
    const fileExt = mediaInfo.mime_type?.split('/')[1] || 'bin';
    const fileName = `${mediaInfo.file_unique_id}.${fileExt}`;

    logger.info('Uploading media to storage', {
      file_name: fileName,
      mime_type: mediaInfo.mime_type,
      size: mediaBuffer.byteLength
    });

    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, mediaBuffer, {
        contentType: mediaInfo.mime_type,
        cacheControl: '3600'
      });

    if (uploadError && !uploadError.message.includes('The resource already exists')) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);

    logger.info('Media upload complete', {
      public_url: publicUrl,
      file_name: fileName
    });

    return {
      success: true,
      publicUrl,
      storagePath: fileName
    };

  } catch (error) {
    logger.error('Failed to download media', { error });
    return {
      success: false,
      error: error.message
    };
  }
}
