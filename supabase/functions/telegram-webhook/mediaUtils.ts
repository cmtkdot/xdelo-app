
import { MediaInfo, TelegramMessage } from "./types";
import { getLogger } from "./logger";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Use the type from the imported library
type SupabaseClient = ReturnType<typeof createClient>;

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
  
  const logger = getLogger('getFileUrl');
  logger.info(`Getting file URL for fileId: ${fileId}`);
  
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  if (!data.ok) throw new Error('Failed to get file path');
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

/**
 * Downloads media from Telegram and stores it in Supabase storage
 */
export async function downloadMedia(
  supabase: SupabaseClient,
  mediaInfo: MediaInfo,
  messageId: string | number,
  telegramToken?: string,
  storagePath?: string
): Promise<string | null> {
  const correlationId = `media-${messageId}-${Date.now()}`;
  const logger = getLogger(correlationId);
  
  if (!mediaInfo) {
    logger.error('No media info provided');
    return null;
  }
  
  try {
    logger.info('Processing media', { 
      messageId,
      fileId: mediaInfo.file_unique_id,
      fileUniqueId: mediaInfo.file_unique_id,
      customPath: !!storagePath
    });
    
    // Use provided storagePath or generate filename using file_unique_id
    let fileName: string;
    if (storagePath) {
      fileName = storagePath;
    } else {
      const mimeType = mediaInfo.mime_type || '';
      const fileExt = mimeType ? mimeType.split('/')[1] || 'bin' : 'bin';
      fileName = `${mediaInfo.file_unique_id}.${fileExt}`;
    }
    
    // Check if file already exists in storage
    const { data: existingFile } = await supabase
      .storage
      .from('telegram-media')
      .list('', {
        search: fileName
      });
      
    const fileExists = existingFile && existingFile.length > 0;
    
    // Get existing URL if file exists
    const { data: { publicUrl: existingUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);
    
    if (fileExists && existingUrl) {
      logger.info('File already exists in storage', { fileName });
      
      // Update message with existing URL if messageId is a valid ID
      if (messageId && messageId !== 'new') {
        try {
          await supabase
            .from('messages')
            .update({
              public_url: existingUrl,
              storage_path: fileName,
              updated_at: new Date().toISOString()
            })
            .eq('id', messageId);
        } catch (updateError) {
          logger.error('Error updating message with existing URL', { error: updateError });
        }
      }
      
      return existingUrl;
    }
    
    // Get file URL from Telegram
    const telegramFileUrl = await getFileUrl(mediaInfo.file_id, telegramToken);
    
    // Download media from Telegram
    let mediaBuffer: ArrayBuffer;
    try {
      const mediaResponse = await fetch(telegramFileUrl);
      if (!mediaResponse.ok) {
        throw new Error(`Failed to download media from Telegram: ${mediaResponse.status} ${mediaResponse.statusText}`);
      }
      
      mediaBuffer = await mediaResponse.arrayBuffer();
      logger.info('Successfully downloaded from Telegram', {
        fileSize: mediaBuffer.byteLength,
        fileName
      });
    } catch (downloadError) {
      logger.error('Download error', { error: downloadError });
      
      if (existingUrl) {
        logger.info('Using existing file despite download error', {
          publicUrl: existingUrl
        });
        return existingUrl;
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
          upsert: true,
          cacheControl: '3600'
        });
      
      if (uploadError) {
        // If file exists, just use the existing URL
        if (uploadError.message.includes('The resource already exists')) {
          logger.info('File exists, using existing URL');
        } else {
          throw uploadError;
        }
      } else {
        logger.info('New file uploaded successfully', { fileName });
      }
    } catch (uploadError) {
      logger.error('Upload error', { error: uploadError });
      
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
    
    // Update message with public URL if messageId is a valid ID
    if (messageId && messageId !== 'new') {
      try {
        await supabase
          .from('messages')
          .update({
            public_url: publicUrl,
            storage_path: fileName,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      } catch (updateError) {
        logger.error('Error updating message with public URL', { error: updateError });
      }
    }
    
    logger.info('Media processing completed', { publicUrl, fileName });
    
    return publicUrl;
    
  } catch (error) {
    logger.error('Media processing failed', {
      messageId,
      error: error.message,
      stack: error.stack
    });
    
    // Update message with error status if messageId is a valid ID
    if (messageId && messageId !== 'new') {
      try {
        await supabase
          .from('messages')
          .update({
            error_message: error.message,
            processing_state: 'error',
            last_error_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      } catch (updateError) {
        logger.error('Error updating message with error status', { error: updateError });
      }
    }
    
    return null;
  }
}

// Legacy function for backward compatibility
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
    // Generate filename with chat_id to ensure uniqueness across chats
    const mimeType = mediaInfo.mime_type || '';
    const fileExt = mimeType ? mimeType.split('/')[1] || 'bin' : 'bin';
    const storagePath = `${message.chat.id}_${mediaInfo.file_unique_id}.${fileExt}`;
    
    // Use the new downloadMedia function with the custom storage path
    const publicUrl = await downloadMedia(
      supabase,
      mediaInfo,
      message.message_id,
      telegramToken,
      storagePath
    );
    
    if (!publicUrl) {
      throw new Error('Failed to download media');
    }
    
    return {
      publicUrl,
      storagePath
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
