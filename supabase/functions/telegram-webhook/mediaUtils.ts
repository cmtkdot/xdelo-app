import { SupabaseClient } from "@supabase/supabase-js";
import { MediaInfo, TelegramMessage } from "./types";

// Add Deno type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export function extractMediaInfo(message: TelegramMessage): MediaInfo | null {
  if (message.photo) {
    const photo = message.photo[message.photo.length - 1]; // Get largest photo
    return {
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      mimeType: 'image/jpeg',
      mediaType: 'photo',
      width: photo.width,
      height: photo.height,
      fileSize: photo.file_size
    };
  } 
  
  if (message.video) {
    return {
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      mimeType: message.video.mime_type || 'video/mp4',
      mediaType: 'video',
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      fileSize: message.video.file_size
    };
  } 
  
  if (message.document) {
    return {
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id,
      mimeType: message.document.mime_type || 'application/octet-stream',
      mediaType: 'document',
      fileSize: message.document.file_size
    };
  }
  
  return null;
}

export async function downloadAndStoreMedia(
  mediaInfo: MediaInfo,
  supabase: SupabaseClient,
  correlationId: string
): Promise<string | null> {
  try {
    console.log('📥 Processing media:', {
      correlation_id: correlationId,
      fileId: mediaInfo.fileId,
      fileUniqueId: mediaInfo.fileUniqueId
    });

    // Generate filename using fileUniqueId
    const fileExt = (mediaInfo.mimeType?.split('/')[1] || 'bin').toLowerCase();
    const fileName = `${mediaInfo.fileUniqueId}.${fileExt}`;

    // Check if file already exists
    const { data: { publicUrl: existingUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);

    if (existingUrl) {
      console.log('♻️ File exists, using existing URL:', {
        correlation_id: correlationId,
        file_name: fileName,
        public_url: existingUrl
      });
      return existingUrl;
    }

    // Get file path from Telegram
    console.log('🔍 Getting file path from Telegram:', {
      correlation_id: correlationId,
      fileId: mediaInfo.fileId
    });

    const fileResponse = await fetch(
      `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/getFile?file_id=${mediaInfo.fileId}`
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
    
    console.log('📥 Successfully downloaded from Telegram:', {
      correlation_id: correlationId,
      file_size: mediaBuffer.byteLength
    });

    // Upload to storage
    console.log('📤 Attempting upload:', {
      correlation_id: correlationId,
      file_name: fileName
    });

    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, mediaBuffer, {
        contentType: mediaInfo.mimeType,
        upsert: false // Don't overwrite if exists
      });

    if (uploadError) {
      if (uploadError.message.includes('The resource already exists')) {
        console.log('ℹ️ File exists during upload, using existing:', {
          correlation_id: correlationId,
          file_name: fileName
        });
      } else {
        console.error('❌ Upload error:', {
          correlation_id: correlationId,
          error: uploadError.message
        });
        throw uploadError;
      }
    } else {
      console.log('✅ New file uploaded successfully:', {
        correlation_id: correlationId,
        file_name: fileName
      });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);

    console.log('✅ Media processing completed:', {
      correlation_id: correlationId,
      file_name: fileName,
      public_url: publicUrl
    });
    
    return publicUrl;

  } catch (error) {
    console.error('❌ Media processing failed:', {
      correlation_id: correlationId,
      error: error.message,
      stack: error.stack
    });
    return null;
  }
}