
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
  const { data: existingFile, error: queryError } = await supabase
    .from('messages')
    .select('id, file_unique_id, storage_path, public_url')
    .eq('file_unique_id', media.file_unique_id)
    .limit(1);

  // Log query errors but continue processing
  if (queryError) {
    console.error('Error querying for existing file:', queryError);
  }

  // If we already have this file, return the existing information
  if (existingFile && existingFile.length > 0) {
    console.log(`Duplicate file detected: ${media.file_unique_id}, reusing existing file information`);
    
    // Check if the existing file is valid before reusing
    const { data: validationResult } = await supabase
      .rpc('xdelo_validate_file_storage', {
        p_file_unique_id: media.file_unique_id,
        p_storage_path: existingFile[0].storage_path,
        p_mime_type: video ? (video.mime_type || 'video/mp4') :
                  document ? (document.mime_type || 'application/octet-stream') :
                  'image/jpeg'
      });

    // Log duplicate file usage
    await logMessageOperation('info', crypto.randomUUID(), {
      action: 'duplicate_file_detected',
      file_unique_id: media.file_unique_id,
      original_message_id: existingFile[0].id,
      storage_path: existingFile[0].storage_path,
      validation_result: validationResult
    });

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
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${media.file_id}`
    );
    
    if (!fileInfoResponse.ok) {
      const errorText = await fileInfoResponse.text();
      throw new Error(`Failed to get file info from Telegram: ${errorText}`);
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
      const errorText = await fileDataResponse.text();
      throw new Error(`Failed to download file from Telegram: ${errorText}`);
    }
    
    const fileData = await fileDataResponse.blob();

    if (!fileData || fileData.size === 0) {
      throw new Error('Downloaded empty file from Telegram');
    }

    // Get mime type and extension
    const mimeType = video ? (video.mime_type || 'video/mp4') :
                  document ? (document.mime_type || 'application/octet-stream') :
                  'image/jpeg';
    
    const extension = mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;

    // Upload to Supabase Storage with improved error handling
    try {
      const { error: uploadError } = await supabase
        .storage
        .from('telegram-media')
        .upload(fileName, fileData, {
          contentType: mimeType,
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
      }
    } catch (uploadErr) {
      console.error('Unexpected upload error:', uploadErr);
      // Continue with the function, but mark the file for redownload
      await logMessageOperation('error', crypto.randomUUID(), {
        action: 'upload_failed',
        file_unique_id: media.file_unique_id,
        error: uploadErr.message,
        needs_redownload: true
      });

      // We'll return a result with needs_redownload flag
      return {
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: mimeType,
        file_size: media.file_size,
        width: media.width,
        height: media.height,
        duration: video?.duration,
        storage_path: fileName,
        public_url: `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${fileName}`,
        needs_redownload: true,
        error: uploadErr.message
      };
    }

    // Log successful upload
    await logMessageOperation('success', crypto.randomUUID(), {
      action: 'media_uploaded',
      file_unique_id: media.file_unique_id,
      storage_path: fileName,
      size: fileData.size,
      mime_type: mimeType
    });

    // Get public URL - matches the trigger-generated URL format
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
      is_duplicate: false
    }
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails, construct a URL based on file_unique_id and mark for redownload
    if (media.file_unique_id) {
      const mimeType = video ? (video.mime_type || 'video/mp4') : 
                    document ? (document.mime_type || 'application/octet-stream') : 
                    'image/jpeg';
      const extension = mimeType.split('/')[1];
      const fileName = `${media.file_unique_id}.${extension}`;
      const publicUrl = `https://xjhhehxcxkiumnwbirel.supabase.co/storage/v1/object/public/telegram-media/${fileName}`;
      
      // Log the error
      await logMessageOperation('error', crypto.randomUUID(), {
        action: 'download_failed',
        file_unique_id: media.file_unique_id,
        error: error.message,
        needs_redownload: true
      });
      
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

// Function to check and flag files for redownload with improved error handling
export const checkAndFlagForRedownload = async (messageId: string, fileUniqueId: string, storageFile: string) => {
  try {
    console.log(`Checking file existence: ${storageFile} for message ${messageId}`);
    
    // Guard against invalid storage path
    if (!storageFile || storageFile.trim() === '') {
      console.error('Invalid storage file path:', storageFile);
      
      // Flag for redownload with corrected path
      await supabase.rpc('xdelo_flag_file_for_redownload', {
        p_message_id: messageId,
        p_reason: 'Invalid storage path'
      });
      
      return { 
        exists: false, 
        flagged: true,
        error: 'Invalid storage path'
      };
    }
    
    // Check if file exists in storage
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .download(storageFile);
    
    // If file exists and has content, it's fine
    if (data && !error) {
      // Record successful validation
      await supabase.from('storage_validations').upsert({
        file_unique_id: fileUniqueId,
        storage_path: storageFile,
        last_checked_at: new Date().toISOString(),
        is_valid: true,
        error_message: null
      }, { onConflict: 'file_unique_id' });
      
      return { exists: true, size: data.size };
    }
    
    console.error('Storage error when checking file:', error);
    
    // Record failed validation
    await supabase.from('storage_validations').upsert({
      file_unique_id: fileUniqueId,
      storage_path: storageFile,
      last_checked_at: new Date().toISOString(),
      is_valid: false,
      error_message: error ? error.message : 'File not found in storage'
    }, { onConflict: 'file_unique_id' });
    
    // File doesn't exist or error occurred, flag for redownload
    const { error: flagError } = await supabase
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
    
    // Always flag for redownload on any error
    try {
      const { error: flagError } = await supabase
        .rpc('xdelo_flag_file_for_redownload', {
          p_message_id: messageId,
          p_reason: `Check error: ${error.message}`
        });
        
      if (flagError) {
        console.error('Error flagging file for redownload:', flagError);
      }
    } catch (flagError) {
      console.error('Error during flag operation:', flagError);
    }
    
    return { exists: false, error: error.message };
  }
}

// Function to attempt redownload of missing files
export const redownloadMissingFile = async (message: any) => {
  try {
    console.log('Attempting to redownload missing file for message:', message.id);
    
    if (!message.file_id) {
      throw new Error('Missing file_id for redownload');
    }
    
    // Get file info from Telegram using the stored file_id
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${message.file_id}`
    );
    
    if (!fileInfoResponse.ok) {
      const errorText = await fileInfoResponse.text();
      throw new Error(`Failed to get file info from Telegram: ${errorText}`);
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
      const errorText = await fileDataResponse.text();
      throw new Error(`Failed to download file from Telegram: ${errorText}`);
    }
    
    const fileData = await fileDataResponse.blob();

    if (!fileData || fileData.size === 0) {
      throw new Error('Downloaded empty file from Telegram');
    }

    // Extract storage path or create from file_unique_id and mime_type
    const mimeType = message.mime_type || 'image/jpeg';
    const extension = mimeType.split('/')[1];
    const storagePath = message.file_unique_id + '.' + extension;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Update the storage validation record
    await supabase
      .from('storage_validations')
      .upsert({
        file_unique_id: message.file_unique_id,
        storage_path: storagePath,
        last_checked_at: new Date().toISOString(),
        is_valid: true,
        error_message: null
      }, { onConflict: 'file_unique_id' });

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
      storage_path: storagePath,
      size: fileData.size
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
