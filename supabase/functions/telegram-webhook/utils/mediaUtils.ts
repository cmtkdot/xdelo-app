import { MediaInfo, TelegramMessage } from "../types.ts";
import { getLogger } from "./logger.ts";
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
      file_size: photo.file_size,
      media_type: 'photo'
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
      file_size: message.video.file_size,
      media_type: 'video'
    };
  } 
  
  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type || 'application/octet-stream',
      file_size: message.document.file_size,
      media_type: 'document'
    };
  }
  
  // Voice messages are not included in the current TelegramMessage type
  // If voice support is needed, update the TelegramMessage type in types.ts
  
  return null;
}

// Cache the token to avoid repeated environment lookups
let cachedTelegramToken: string | null = null;

export async function getFileUrl(fileId: string, telegramToken?: string): Promise<string> {
  // Use provided token, cached token, or get from environment
  const token = telegramToken || cachedTelegramToken || (globalThis as any).Deno?.env.get('TELEGRAM_BOT_TOKEN');
  
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
  }
  
  // Cache the token for future use
  if (!cachedTelegramToken && token) {
    cachedTelegramToken = token;
  }
  
  console.log('🔍 Getting file URL for fileId:', fileId);
  const response = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  if (!data.ok) throw new Error('Failed to get file path');
  return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
}

/**
 * Downloads media from Telegram and stores it in Supabase storage
 * 
 * @param supabase Supabase client
 * @param mediaInfo Media information object
 * @param messageId Message ID or 'new' for new messages
 * @param telegramToken Optional Telegram bot token
 * @returns Public URL of the stored media or null if failed
 */
export async function downloadMedia(
  supabase: SupabaseClient,
  mediaInfo: MediaInfo,
  messageId: string | number,
  telegramToken?: string
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
      fileId: mediaInfo.file_id,
      fileUniqueId: mediaInfo.file_unique_id
    });
    
    // Generate filename using file_unique_id
    const mimeType = mediaInfo.mime_type || '';
    const fileExt = mimeType ? mimeType.split('/')[1] || 'bin' : 'bin';
    const fileName = `${mediaInfo.file_unique_id}.${fileExt}`;
    
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
              updated_at: new Date().toISOString()
            })
            .eq('id', messageId);
        } catch (updateError) {
          logger.error('Error updating message with existing URL', { error: updateError });
          // Continue despite update error
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
        
        // Update message with existing URL if messageId is a valid ID
        if (messageId && messageId !== 'new') {
          try {
            await supabase
              .from('messages')
              .update({
                public_url: existingUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', messageId);
          } catch (updateError) {
            logger.error('Error updating message with existing URL', { error: updateError });
            // Continue despite update error
          }
        }
        
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
    
    // Update message with public URL if messageId is a valid ID
    if (messageId && messageId !== 'new') {
      try {
        await supabase
          .from('messages')
          .update({
            public_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      } catch (updateError) {
        logger.error('Error updating message with public URL', { error: updateError });
        // Continue despite update error
      }
    }
    
    logger.info('Media processing completed', { publicUrl });
    
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
        // Continue despite update error
      }
    }
    
    return null;
  }
}

/**
 * Legacy function for downloading and storing media from a message
 * Maintained for backward compatibility
 */
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
    // Use the new downloadMedia function
    const publicUrl = await downloadMedia(
      supabase,
      mediaInfo,
      message.message_id,
      telegramToken
    );
    
    if (!publicUrl) {
      throw new Error('Failed to download media');
    }
    
    // Generate filename for storage path
    const mimeType = mediaInfo.mime_type || '';
    const fileExt = mimeType ? mimeType.split('/')[1] || 'bin' : 'bin';
    const storagePath = `${mediaInfo.file_unique_id}.${fileExt}`;
    
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
