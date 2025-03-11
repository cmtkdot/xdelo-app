
import { logMessageOperation } from './logger.ts';
import { supabaseClient as supabase } from '../../_shared/supabase.ts';
import { 
  xdelo_detectMimeType,
  xdelo_constructStoragePath,
  xdelo_uploadMediaToStorage
} from '../../_shared/mediaUtils.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

export const getMediaInfo = async (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document
  
  const media = photo || video || document
  if (!media) throw new Error('No media found in message')

  // Check if file already exists in the database
  const { data: existingFile } = await supabase
    .from('messages')
    .select('id, file_unique_id, storage_path, public_url, mime_type')
    .eq('file_unique_id', media.file_unique_id)
    .limit(1)

  try {
    // Always get file info from Telegram for all messages, even duplicates
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${media.file_id}`
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }

    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Get mime type using our enhanced detection
    const mediaObj = {
      photo: photo,
      video: video,
      document: document
    };
    const mimeType = xdelo_detectMimeType(mediaObj);
    
    // Generate standardized storage path
    const fileName = xdelo_constructStoragePath(media.file_unique_id, mimeType);

    // Upload to Supabase Storage always, even for duplicates
    const uploadSuccess = await xdelo_uploadMediaToStorage(
      fileData,
      fileName,
      mimeType
    );

    if (!uploadSuccess) {
      throw new Error('Failed to upload media to storage');
    }

    // Generate public URL
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;

    // If it's a duplicate, return info including existing message ID
    if (existingFile && existingFile.length > 0) {
      return {
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: mimeType,
        file_size: media.file_size,
        width: media.width,
        height: media.height,
        duration: video?.duration,
        storage_path: fileName,
        public_url: publicUrl,
        is_duplicate: true,
        existing_message_id: existingFile[0].id
      }
    }

    // Return the new file info
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      is_duplicate: false
    }
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails, construct a URL based on file_unique_id and mark for redownload
    const mimeType = video ? (video.mime_type || 'video/mp4') : 
                  document ? (document.mime_type || 'application/octet-stream') : 
                  'image/jpeg';
    const fileName = xdelo_constructStoragePath(media.file_unique_id, mimeType);
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;
    
    // If there's an existing file, return its storage path to avoid loss
    if (existingFile && existingFile.length > 0) {
      return {
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: existingFile[0].mime_type || mimeType,
        file_size: media.file_size,
        width: media.width,
        height: media.height,
        duration: video?.duration,
        storage_path: existingFile[0].storage_path,
        public_url: existingFile[0].public_url,
        is_duplicate: true,
        existing_message_id: existingFile[0].id,
        error: error.message
      };
    }
    
    // Log the error but don't throw - we'll return a placeholder and flag for redownload
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      needs_redownload: true,
      error: error.message
    };
  }
}

// Enhanced function to redownload missing files
export const redownloadMissingFile = async (message: any) => {
  try {
    console.log('Attempting to redownload file for message:', message.id);
    
    if (!message.file_id) {
      throw new Error('Missing file_id for redownload');
    }
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${message.file_id}`
    );
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }

    // Download file from Telegram
    const fileDataResponse = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Use the provided MIME type or try to detect it
    const mimeType = message.mime_type || 'application/octet-stream';
    
    // Generate standardized storage path
    const fileName = xdelo_constructStoragePath(message.file_unique_id, mimeType);

    // Upload to storage
    const uploadSuccess = await xdelo_uploadMediaToStorage(
      fileData,
      fileName,
      mimeType
    );

    if (!uploadSuccess) {
      throw new Error('Failed to upload media to storage during redownload');
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        storage_path: `telegram-media/${fileName}`,
        error_message: null
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update message after redownload: ${updateError.message}`);
    }

    // Log success
    await logMessageOperation('success', crypto.randomUUID(), {
      action: 'redownload_completed',
      file_unique_id: message.file_unique_id,
      storage_path: fileName
    });

    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: fileName
    };
  } catch (error) {
    console.error('Failed to redownload file:', error);
    
    // Update the message with failure info
    try {
      await supabase
        .from('messages')
        .update({
          redownload_attempts: (message.redownload_attempts || 0) + 1,
          error_message: `Redownload failed: ${error.message}`,
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);
    } catch (updateErr) {
      console.error('Error updating error state:', updateErr);
    }
    
    // Log failure
    await logMessageOperation('error', crypto.randomUUID(), {
      action: 'redownload_failed',
      file_unique_id: message.file_unique_id,
      error: error.message
    });
    
    return {
      success: false,
      message_id: message.id,
      error: error.message
    };
  }
}
