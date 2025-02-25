
import { SupabaseClient } from '@supabase/supabase-js';
import { MediaInfo, TelegramMessage } from './types';
import { getLogger } from './logger';

interface MediaResult {
  success: boolean;
  error?: string;
  publicUrl?: string;
  storagePath?: string;
}

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
  const correlationId = crypto.randomUUID();
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Processing media', {
      message_id: messageId,
      file_id: mediaInfo.file_id,
      file_unique_id: mediaInfo.file_unique_id
    });

    // Generate filename using file_unique_id
    const fileExt = mediaInfo.mime_type.split('/')[1] || 'bin';
    const fileName = `${mediaInfo.file_unique_id}.${fileExt}`;

    // Check existing URL first but don't stop if exists
    const { data: { publicUrl: existingUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);

    // Get media from Telegram
    let mediaBuffer: ArrayBuffer;
    try {
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
      
      mediaBuffer = await mediaResponse.arrayBuffer();
      
      logger.info('Successfully downloaded from Telegram', {
        file_size: mediaBuffer.byteLength
      });
    } catch (downloadError) {
      logger.error('Download error', {
        error: downloadError.message
      });

      // If we have existing URL, use it despite download error
      if (existingUrl) {
        logger.info('Using existing file despite download error', {
          public_url: existingUrl
        });

        // Update message with existing URL
        await supabase
          .from('messages')
          .update({
            public_url: existingUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);

        return existingUrl;
      }

      throw downloadError;
    }

    // Try to upload - this may fail if file exists
    try {
      logger.info('Attempting upload', {
        file_name: fileName
      });

      const { error: uploadError } = await supabase
        .storage
        .from('telegram-media')
        .upload(fileName, mediaBuffer, {
          contentType: mediaInfo.mime_type,
          cacheControl: '3600'
        });

      if (uploadError) {
        // If file exists, just use the existing URL
        if (uploadError.message.includes('The resource already exists')) {
          logger.info('File exists, using existing URL', {
            public_url: existingUrl
          });
        } else {
          throw uploadError;
        }
      } else {
        logger.info('New file uploaded successfully', {
          file_name: fileName
        });
      }
    } catch (uploadError) {
      logger.error('Upload error', {
        error: uploadError.message
      });

      // If we have existing URL, use it despite upload error
      if (existingUrl) {
        logger.info('Using existing file despite upload error', {
          public_url: existingUrl
        });
      } else {
        throw uploadError;
      }
    }

    // Get final public URL (whether new upload or existing)
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(fileName);

    // Update message with public URL
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      logger.error('Error updating message', {
        error: updateError
      });
      throw updateError;
    }

    logger.info('Media processing completed', {
      public_url: publicUrl
    });
    
    return publicUrl;

  } catch (error) {
    logger.error('Media processing failed', {
      message_id: messageId,
      error: error.message,
      stack: error.stack
    });
    
    // Update message with error status
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

export async function downloadAndStoreMedia(
  message: TelegramMessage,
  supabase: SupabaseClient,
  correlationId: string
): Promise<MediaResult> {
  const logger = getLogger(correlationId);
  
  try {
    const mediaInfo = extractMediaInfo(message);
    if (!mediaInfo) {
      logger.error('No media found in message', { messageId: message.message_id });
      return { success: false, error: 'No media found in message' };
    }

    const publicUrl = await downloadMedia(supabase, mediaInfo, message.message_id.toString());
    if (!publicUrl) {
      return { success: false, error: 'Failed to download and store media' };
    }

    const storagePath = `${mediaInfo.file_unique_id}.${mediaInfo.mime_type.split('/')[1] || 'bin'}`;
    
    return {
      success: true,
      publicUrl,
      storagePath
    };
  } catch (error) {
    logger.error('Failed to download media', { error });
    return {
      success: false,
      error: error.message
    };
  }
}
