import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MediaInfo, TelegramMessage } from "../types.ts";
import { getLogger } from "./logger.ts";

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

// Cache the token to avoid repeated environment lookups
let cachedTelegramToken: string | null = null;

export async function getFileUrl(fileId: string, telegramToken?: string): Promise<string> {
  // Use provided token, cached token, or get from environment
  const token = telegramToken || cachedTelegramToken || Deno.env.get('TELEGRAM_BOT_TOKEN');
  
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }
  
  // Cache the token for future use
  if (!cachedTelegramToken && token) {
    cachedTelegramToken = token;
  }
  
  console.log('🔍 Getting file URL for fileId:', fileId);
  const response = await fetch(
    `https://api.telegram.org/bot${telegramToken}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  if (!data.ok) throw new Error('Failed to get file path');
  return `https://api.telegram.org/file/bot${telegramToken}/${data.result.file_path}`;
}

export async function downloadAndStoreMedia(
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string,
  telegramToken?: string
): Promise<{ publicUrl: string; storagePath: string } | null> {
  const logger = getLogger(correlationId);
  const mediaInfo = extractMediaInfo(message);
  
  if (!mediaInfo) {
    logger.error('No media found in message', { messageId: message.message_id });
    return null;
  }
  
  try {
    logger.info('Processing media', { 
      messageId: message.message_id,
      fileId: mediaInfo.file_id,
      fileUniqueId: mediaInfo.file_unique_id
    });
    
    // Generate filename using file_unique_id
    const fileExt = mediaInfo.mime_type?.split('/')[1] || 'bin';
    const fileName = `${mediaInfo.file_unique_id}.${fileExt}`;
    
    // Check if file already exists in storage
    const { data: { publicUrl: existingUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);
    
    // Get file URL from Telegram
    const telegramFileUrl = await getFileUrl(mediaInfo.file_id, telegramToken);
    
    // Download media from Telegram
    let mediaBuffer: ArrayBuffer;
    try {
      const mediaResponse = await fetch(telegramFileUrl);
      if (!mediaResponse.ok) {
        throw new Error('Failed to download media from Telegram');
      }
      
      mediaBuffer = await mediaResponse.arrayBuffer();
      logger.info('Successfully downloaded from Telegram', {
        fileSize: mediaBuffer.byteLength
      });
    } catch (downloadError) {
      logger.error('Download error', { error: downloadError });
      
      // If we have existing URL, use it despite download error
      if (existingUrl) {
        logger.info('Using existing file despite download error', {
          publicUrl: existingUrl
        });
        return { 
          publicUrl: existingUrl, 
          storagePath: fileName 
        };
      }
      
      throw downloadError;
    }
    
    // Upload to storage
    try {
      logger.info('Uploading media to storage', { fileName });
      
      const { error: uploadError } = await supabase
        .storage
        .from('telegram-media')
        .upload(fileName, mediaBuffer, {
          contentType: mediaInfo.mime_type,
          upsert: true
        });
      
      if (uploadError) {
        // If file exists, just use the existing URL
        if (uploadError.message.includes('The resource already exists')) {
          logger.info('File exists, using existing URL', {
            publicUrl: existingUrl
          });
        } else {
          throw uploadError;
        }
      } else {
        logger.info('New file uploaded successfully', { fileName });
      }
    } catch (uploadError) {
      logger.error('Upload error', { error: uploadError });
      
      // If we have existing URL, use it despite upload error
      if (existingUrl) {
        logger.info('Using existing file despite upload error', {
          publicUrl: existingUrl
        });
      } else {
        throw uploadError;
      }
    }
    
    // Get final public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);
    
    logger.info('Media processing completed', { publicUrl });
    
    return {
      publicUrl,
      storagePath: fileName
    };
    
  } catch (error) {
    logger.error('Media processing failed', {
      messageId: message.message_id,
      error: error.message,
      stack: error.stack
    });
    
    return null;
  }
}
