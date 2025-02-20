
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

interface MediaInfo {
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
    // For photos, use the last (highest quality) version
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
  mediaInfo: MediaInfo,
  messageId: string
): Promise<string | null> {
  try {
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

    // Generate storage path
    const fileExt = mediaInfo.mime_type.split('/')[1] || 'bin';
    const storagePath = `${messageId}/${mediaInfo.file_unique_id}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mediaInfo.mime_type,
        cacheControl: '3600'
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    // Update message with storage path and public URL
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        storage_path: storagePath,
        public_url: publicUrl
      })
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    return publicUrl;
  } catch (error) {
    console.error('Error downloading media:', error);
    return null;
  }
}
