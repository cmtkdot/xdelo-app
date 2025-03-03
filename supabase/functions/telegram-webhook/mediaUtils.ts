
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { logMessageOperation } from './logger.ts';

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')

// Create Supabase client with storage capabilities
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export const getMediaInfo = async (message: any) => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null
  const video = message.video
  const document = message.document
  
  const media = photo || video || document
  if (!media) throw new Error('No media found in message')

  // Check if file already exists in the database
  const { data: existingFile } = await supabase
    .from('messages')
    .select('file_unique_id, storage_path, public_url')
    .eq('file_unique_id', media.file_unique_id)
    .limit(1)

  // If we already have this file, return the existing information
  if (existingFile && existingFile.length > 0) {
    console.log(`Duplicate file detected: ${media.file_unique_id}, reusing existing file information`)
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: video ? (video.mime_type || 'video/mp4') :
                document ? (document.mime_type || 'application/octet-stream') :
                'image/jpeg',
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: existingFile[0].storage_path,
      public_url: existingFile[0].public_url,
      is_duplicate: true
    }
  }

  try {
    // Get file info from Telegram
    const fileInfo = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${media.file_id}`
    ).then(res => res.json())

    if (!fileInfo.ok) throw new Error('Failed to get file info from Telegram')

    // Download file from Telegram
    const fileData = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    ).then(res => res.blob())

    // Get mime type and extension
    const mimeType = video ? (video.mime_type || 'video/mp4') :
                  document ? (document.mime_type || 'application/octet-stream') :
                  'image/jpeg'
    
    const extension = mimeType.split('/')[1]
    const fileName = `${media.file_unique_id}.${extension}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, fileData, {
        contentType: mimeType,
        upsert: true
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`)
    }

    // Get public URL - matches the trigger-generated URL format
    const publicUrl = `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${fileName}`

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
    
    // If download fails but we had the file before, construct a URL based on file_unique_id
    if (media.file_unique_id) {
      const mimeType = video ? (video.mime_type || 'video/mp4') : 
                    document ? (document.mime_type || 'application/octet-stream') : 
                    'image/jpeg';
      const extension = mimeType.split('/')[1];
      const fileName = `${media.file_unique_id}.${extension}`;
      const publicUrl = `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${fileName}`;
      
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
    
    throw error;
  }
}

// New function to check and flag files for redownload
export const checkAndFlagForRedownload = async (messageId: string, fileUniqueId: string, storageFile: string) => {
  try {
    // Check if file exists in storage
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .download(storageFile);
    
    // If file exists and has content, it's fine
    if (data && !error) {
      return { exists: true, size: data.size };
    }
    
    // File doesn't exist or error occurred, flag for redownload
    const { data: flagResult, error: flagError } = await supabase
      .rpc('xdelo_flag_file_for_redownload', {
        p_message_id: messageId,
        p_reason: error ? `Storage error: ${error.message}` : 'File not found in storage'
      });
      
    if (flagError) {
      console.error('Error flagging file for redownload:', flagError);
    }
    
    return { 
      exists: false, 
      flagged: !flagError,
      error: error?.message || 'File not found'
    };
  } catch (error) {
    console.error('Error checking file existence:', error);
    return { exists: false, error: error.message };
  }
}

// Function to attempt redownload of missing files
export const redownloadMissingFile = async (message: any) => {
  try {
    console.log('Attempting to redownload missing file for message:', message.id);
    
    // Get file info from Telegram using the stored file_id
    const fileInfo = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${message.file_id}`
    ).then(res => res.json());

    if (!fileInfo.ok) throw new Error(`Failed to get file info from Telegram: ${JSON.stringify(fileInfo)}`);

    // Download file from Telegram
    const fileData = await fetch(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`
    ).then(res => res.blob());

    if (!fileData || fileData.size === 0) {
      throw new Error('Downloaded empty file from Telegram');
    }

    // Extract storage path or create from file_unique_id and mime_type
    const storagePath = message.storage_path || `${message.file_unique_id}.${(message.mime_type || 'image/jpeg').split('/')[1]}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: message.mime_type || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        needs_redownload: false,
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        redownload_completed_at: new Date().toISOString(),
        storage_path: storagePath,
        error_message: null
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update message after redownload: ${updateError.message}`);
    }

    // Log success
    await logMessageOperation('success', message.id, {
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
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        error_message: `Redownload failed: ${error.message}`,
        last_error_at: new Date().toISOString()
      })
      .eq('id', message.id);
      
    if (updateError) {
      console.error('Failed to update message after redownload failure:', updateError);
    }
    
    // Log failure
    await logMessageOperation('error', message.id, {
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
