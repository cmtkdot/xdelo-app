
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

export interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export function extractMediaInfo(message: any): MediaInfo | null {
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
  } else if (message.video) {
    return {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      mime_type: message.video.mime_type,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      file_size: message.video.file_size
    };
  } else if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type,
      file_size: message.document.file_size
    };
  }
  return null;
}

export async function downloadMedia(
  supabase: SupabaseClient,
  mediaInfo: MediaInfo
): Promise<string | null> {
  try {
    // Check if file already exists in storage
    const storagePath = `${mediaInfo.file_unique_id}`;
    const { data: existingFile } = await supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    if (existingFile?.publicUrl) {
      console.log('Media already exists:', existingFile.publicUrl);
      return existingFile.publicUrl;
    }

    // Get file info from Telegram
    const fileResponse = await fetch(
      `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/getFile?file_id=${mediaInfo.file_id}`
    );
    
    const fileData = await fileResponse.json();
    if (!fileData.ok || !fileData.result.file_path) {
      throw new Error('Failed to get file path from Telegram');
    }

    // Download file from Telegram
    const fileUrl = `https://api.telegram.org/file/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/${fileData.result.file_path}`;
    const mediaResponse = await fetch(fileUrl);
    const mediaBuffer = await mediaResponse.arrayBuffer();

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mediaInfo.mime_type,
        cacheControl: '31536000', // 1 year cache
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    return publicUrl;
  } catch (error) {
    console.error('Error downloading media:', error);
    return null;
  }
}
