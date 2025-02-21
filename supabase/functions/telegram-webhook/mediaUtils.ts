import { SupabaseClient } from "@supabase/supabase-js";
import { MediaInfo, TelegramMessage } from "./types";

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
  
  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type || 'application/octet-stream',
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
    console.log('📥 Downloading media:', {
      message_id: messageId,
      file_id: mediaInfo.file_id
    });

    // Get file path from Telegram
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
    if (!mediaResponse.ok) {
      throw new Error('Failed to download media from Telegram');
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer();

    // Generate storage path with messageId for organization
    const fileExt = mediaInfo.mime_type.split('/')[1] || 'bin';
    const storagePath = `${messageId}/${mediaInfo.file_unique_id}.${fileExt}`;

    console.log('📤 Uploading to storage:', { storagePath });

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mediaInfo.mime_type,
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    // Update message with storage info
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        storage_path: storagePath,
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    console.log('✅ Media processed successfully:', { publicUrl });
    return publicUrl;

  } catch (error) {
    console.error('❌ Error processing media:', error);
    
    // Update message with error
    await supabase
      .from('messages')
      .update({
        error_message: error.message,
        processing_state: 'error',
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    return null;
  }
}