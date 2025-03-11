
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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

// Helper to determine if the MIME type is viewable in browser
function isViewableMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || 
         mimeType.startsWith('video/') || 
         mimeType === 'application/pdf';
}

// Helper to get proper upload options based on MIME type
function getUploadOptions(mimeType: string): any {
  // Default options for all uploads
  const options = {
    contentType: mimeType || 'application/octet-stream',
    upsert: true
  };
  
  // Add inline content disposition for viewable types
  if (isViewableMimeType(mimeType)) {
    return {
      ...options,
      contentDisposition: 'inline'
    };
  }
  
  return options;
}

/**
 * Extract and process media from a Telegram message
 */
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
      is_duplicate: true,
      // Set expiration for file_id (24 hours from now)
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      original_file_id: media.file_id
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

    // Get mime type and extension
    const mimeType = video ? (video.mime_type || 'video/mp4') :
                  document ? (document.mime_type || 'application/octet-stream') :
                  'image/jpeg';
    
    // Standardize the storage path
    const { data: standardPath, error: pathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: media.file_unique_id,
        p_mime_type: mimeType
      }
    );

    if (pathError) {
      console.error('Error getting standardized path:', pathError);
      const extension = mimeType.split('/')[1];
      var fileName = `${media.file_unique_id}.${extension}`;
    } else {
      var fileName = standardPath;
    }

    // Get upload options based on MIME type
    const uploadOptions = getUploadOptions(mimeType);

    // Upload to Supabase Storage with proper content type and disposition
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, fileData, uploadOptions);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // Instead of throwing, we'll return a partial result
      // and flag for redownload
      return {
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: mimeType,
        file_size: media.file_size,
        width: media.width,
        height: media.height,
        duration: video?.duration,
        storage_path: fileName,
        public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`,
        needs_redownload: true,
        redownload_strategy: 'telegram_api',
        file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        original_file_id: media.file_id,
        error: uploadError.message
      };
    }

    // Generate public URL with correct format
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;

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
      is_duplicate: false,
      // Set expiration for file_id (24 hours from now)
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      original_file_id: media.file_id
    }
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // Generate basic info without attempting file checks
    const mimeType = video ? (video.mime_type || 'video/mp4') : 
                  document ? (document.mime_type || 'application/octet-stream') : 
                  'image/jpeg';
    const extension = mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;
    
    // Return basic information with redownload flag
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
      redownload_strategy: 'telegram_api',
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      original_file_id: media.file_id,
      error: error.message
    };
  }
}

/**
 * Simplified redownload function
 */
export const redownloadMissingFile = async (message: any) => {
  try {
    console.log('Attempting to redownload file for message:', message.id);
    
    // First try to use original file_id if available and not expired
    let fileId = message.original_file_id || message.file_id;
    
    // Check if file_id is likely expired
    const fileIdExpired = message.file_id_expires_at && 
                          new Date(message.file_id_expires_at) < new Date();
    
    if (fileIdExpired || !fileId) {
      // If original file_id is expired, try to get a new file_id from another message in the same group
      if (message.media_group_id) {
        const { data: groupFiles } = await supabase
          .from('messages')
          .select('file_id, file_id_expires_at')
          .eq('media_group_id', message.media_group_id)
          .eq('file_unique_id', message.file_unique_id)
          .neq('id', message.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (groupFiles && groupFiles.length > 0 && 
            groupFiles[0].file_id && 
            (!groupFiles[0].file_id_expires_at || new Date(groupFiles[0].file_id_expires_at) > new Date())) {
          fileId = groupFiles[0].file_id;
          console.log(`Using file_id from another message in the same group: ${fileId}`);
        } else {
          console.warn('Could not find valid file_id in media group, using original (may fail)');
        }
      }
    }
    
    if (!fileId) {
      throw new Error('No valid file_id available for redownload');
    }
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
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

    // Get standardized storage path
    const { data: storagePath, error: pathError } = await supabase.rpc(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: message.file_unique_id,
        p_mime_type: message.mime_type
      }
    );

    if (pathError) {
      throw new Error(`Failed to get standardized storage path: ${pathError.message}`);
    }

    // Get proper upload options based on MIME type
    const uploadOptions = getUploadOptions(message.mime_type);

    // Upload to Supabase Storage with proper content type and disposition
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);

    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Update the message with success status
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        storage_path: storagePath,
        file_id: fileInfo.result.file_id,
        file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        error_message: null
      })
      .eq('id', message.id);

    if (updateError) {
      throw new Error(`Failed to update message after redownload: ${updateError.message}`);
    }

    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: storagePath
    };
  } catch (error) {
    console.error('Failed to redownload file:', error);
    
    // Update the message with failure info but without checking file existence
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
    
    return {
      success: false,
      message_id: message.id,
      error: error.message
    };
  }
}
