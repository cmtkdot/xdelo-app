
import { logMessageOperation } from './logger.ts';
import { supabaseClient as supabase } from '../_shared/supabase.ts';
import { 
  xdelo_isViewableMimeType, 
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_getDefaultMimeType,
  xdelo_validateStoragePath,
  xdelo_validateAndFixStoragePath
} from '../_shared/mediaUtils.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

export const getMediaInfo = async (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document
  
  const media = photo || video || document
  if (!media) throw new Error('No media found in message')

  // Check if file already exists in the database
  const { data: existingFiles } = await supabase
    .from('messages')
    .select('file_unique_id, storage_path, public_url, mime_type, file_size, width, height, duration')
    .eq('file_unique_id', media.file_unique_id)
    .eq('deleted_from_telegram', false)
    .limit(1)

  // If we already have this file, return the existing information
  if (existingFiles && existingFiles.length > 0) {
    console.log(`Duplicate file detected: ${media.file_unique_id}, reusing existing file information`)
    
    // Verify the file actually exists in storage
    const fileExists = existingFiles[0].storage_path ? 
      await xdelo_validateStoragePath(`telegram-media/${existingFiles[0].storage_path}`) : 
      false;
      
    if (fileExists) {
      return {
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: existingFiles[0].mime_type,
        file_size: existingFiles[0].file_size || media.file_size,
        width: existingFiles[0].width || media.width,
        height: existingFiles[0].height || media.height,
        duration: existingFiles[0].duration || (video?.duration),
        storage_path: existingFiles[0].storage_path,
        public_url: existingFiles[0].public_url,
        is_duplicate: true,
        storage_exists: true
      }
    } else {
      console.log(`File ${media.file_unique_id} exists in database but not in storage, will reupload`);
      // Continue with upload process since file doesn't actually exist
    }
  }

  try {
    // Get file info from Telegram
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

    // Simplify MIME type detection
    const mimeType = photo ? 'image/jpeg' : 
                    video ? (video.mime_type || 'video/mp4') :
                    document?.mime_type || 'application/octet-stream';
    
    // Simple storage path format - just file_unique_id.extension
    const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;

    // Upload to Supabase Storage with proper content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, fileData, uploadOptions);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Generate public URL with correct path
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;

    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      mime_type_original: document?.mime_type || video?.mime_type,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      is_duplicate: false,
      storage_exists: true,
      storage_path_standardized: true
    }
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails, construct a URL based on file_unique_id and mark for redownload
    const mimeType = video ? (video.mime_type || 'video/mp4') : 
                  document ? (document.mime_type || 'application/octet-stream') : 
                  'image/jpeg';
    const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;
    
    // Log the error but don't throw - we'll return a placeholder and flag for redownload
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      mime_type_original: document?.mime_type || video?.mime_type,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      needs_redownload: true,
      redownload_reason: error.message,
      redownload_flagged_at: new Date().toISOString(),
      is_duplicate: false,
      storage_exists: false
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

    // Simple storage path - just use file_unique_id.extension
    const mimeType = message.mime_type || 'application/octet-stream';
    const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const storagePath = `${message.file_unique_id}.${extension}`;

    // Upload to Supabase Storage with proper content disposition
    const isViewable = xdelo_isViewableMimeType(mimeType);
    const uploadOptions = {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600',
      contentDisposition: isViewable ? 'inline' : 'attachment'
    };
    
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);

    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        storage_path: storagePath,
        public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`,
        error_message: null,
        storage_exists: true,
        storage_path_standardized: true
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update message after redownload: ${updateError.message}`);
    }

    // Log success
    await logMessageOperation('success', crypto.randomUUID(), {
      action: 'redownload_completed',
      file_unique_id: message.file_unique_id,
      storage_path: storagePath
    });

    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: storagePath
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
