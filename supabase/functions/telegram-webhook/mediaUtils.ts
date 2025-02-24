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
  const correlationId = crypto.randomUUID();
  
  try {
    console.log('📥 Processing media:', {
      correlation_id: correlationId,
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
      
      console.log('📥 Successfully downloaded from Telegram:', {
        correlation_id: correlationId,
        file_size: mediaBuffer.byteLength
      });
    } catch (downloadError) {
      console.error('❌ Download error:', {
        correlation_id: correlationId,
        error: downloadError.message
      });

      // If we have existing URL, use it despite download error
      if (existingUrl) {
        console.log('♻️ Using existing file despite download error:', {
          correlation_id: correlationId,
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
      console.log('📤 Attempting upload:', {
        correlation_id: correlationId,
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
          console.log('ℹ️ File exists, using existing URL:', {
            correlation_id: correlationId,
            public_url: existingUrl
          });
        } else {
          throw uploadError;
        }
      } else {
        console.log('✅ New file uploaded successfully:', {
          correlation_id: correlationId,
          file_name: fileName
        });
      }
    } catch (uploadError) {
      console.error('❌ Upload error:', {
        correlation_id: correlationId,
        error: uploadError.message
      });

      // If we have existing URL, use it despite upload error
      if (existingUrl) {
        console.log('♻️ Using existing file despite upload error:', {
          correlation_id: correlationId,
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
      console.error('❌ Error updating message:', {
        correlation_id: correlationId,
        error: updateError
      });
      throw updateError;
    }

    console.log('✅ Media processing completed:', {
      correlation_id: correlationId,
      public_url: publicUrl
    });
    
    return publicUrl;

  } catch (error) {
    console.error('❌ Media processing failed:', {
      correlation_id: correlationId,
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