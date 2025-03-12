import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Initialize Supabase client (will use env vars from edge function context)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Helper to determine if the MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  const viewableTypes = [
    'image/',
    'video/',
    'audio/',
    'text/',
    'application/pdf'
  ];
  return viewableTypes.some(type => mimeType.startsWith(type));
}

// Get default MIME type based on media type - simplified version
export function xdelo_getDefaultMimeType(media: any): string {
  if (!media) return 'application/octet-stream';
  
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker?.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  if (media.document?.mime_type) return media.document.mime_type;
  
  return 'application/octet-stream';
}

// Detect MIME type from Telegram media object - standard implementations
export function xdelo_detectMimeType(media: any): string {
  if (!media) return 'application/octet-stream';
  
  // Simple, standardized MIME type detection - photos are JPEG, videos are MP4
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  
  // For documents, trust Telegram's MIME type if available
  if (media.document?.mime_type) return media.document.mime_type;
  
  // Otherwise use our default mappings
  if (media.document) return 'application/octet-stream';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker?.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  
  return 'application/octet-stream';
}

// Helper to get proper upload options based on MIME type
export function xdelo_getUploadOptions(mimeType: string): any {
  // Default options for all uploads
  const options = {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
    // Set cache control for better performance
    cacheControl: '3600',
    // Always set contentDisposition based on mime type
    contentDisposition: xdelo_isViewableMimeType(mimeType) ? 'inline' : 'attachment'
  };
  
  return options;
}

// Very simple function to get file extension from MIME type
export function xdelo_getFileExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/x-tgsticker': 'tgs',
    'text/plain': 'txt'
  };
  
  return mimeToExt[mimeType] || mimeType.split('/')[1] || 'bin';
}

// Validate if a file exists in storage
export async function xdelo_validateStoragePath(path: string): Promise<boolean> {
  if (!path) return false;
  
  // Extract bucket name and file path
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  // If no bucket/path provided, return false
  if (!bucket || !filePath) return false;
  
  try {
    // Check if file exists using createSignedUrl (more reliable than list)
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 60);
      
    return !error && !!data;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
  }
}

// Simplified function to validate and generate storage path
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('Cannot create storage path: missing file_unique_id');
  }
  
  // Validate the file_unique_id to prevent path traversal attacks
  if (fileUniqueId.includes('/') || fileUniqueId.includes('..')) {
    throw new Error('Invalid file_unique_id: contains forbidden characters');
  }
  
  const extension = xdelo_getFileExtensionFromMimeType(mimeType || 'application/octet-stream');
  // Create a simple path: fileUniqueId.extension
  return `${fileUniqueId}.${extension}`;
}

// Function to retry telegram download for a message
export async function xdelo_retryDownload(messageId: string, telegramBotToken: string): Promise<{ success: boolean, message: string, data?: any }> {
  try {
    // Get the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      return {
        success: false,
        message: `Message not found: ${messageError?.message || 'No data returned'}`
      };
    }
    
    if (!message.file_id) {
      return {
        success: false,
        message: 'Message has no file_id for retry download'
      };
    }
    
    // Get file info from Telegram
    const fileInfoUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${message.file_id}`;
    const fileInfoResponse = await fetch(fileInfoUrl);
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok) {
      // Try alternate file_id from media_group if available
      if (message.media_group_id) {
        const { data: groupData } = await supabase.rpc(
          'xdelo_find_valid_file_id',
          {
            p_media_group_id: message.media_group_id,
            p_file_unique_id: message.file_unique_id
          }
        );
        
        if (groupData) {
          console.log(`Found alternate file_id in media group: ${groupData}`);
          // Retry with new file_id
          const alternateFileInfoUrl = `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${groupData}`;
          const alternateResponse = await fetch(alternateFileInfoUrl);
          
          if (!alternateResponse.ok) {
            throw new Error(`Failed to get file info with alternate file_id: ${await alternateResponse.text()}`);
          }
          
          const alternateFileInfo = await alternateResponse.json();
          
          if (!alternateFileInfo.ok) {
            throw new Error('Failed with alternate file_id as well');
          }
          
          // Use the alternate file info and update file_id
          fileInfo.result = alternateFileInfo.result;
          message.file_id = groupData;
        } else {
          throw new Error(`No valid file_id found: ${JSON.stringify(fileInfo)}`);
        }
      } else {
        throw new Error(`No valid file_id found: ${JSON.stringify(fileInfo)}`);
      }
    }
    
    // Download file from Telegram
    const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`;
    const fileResponse = await fetch(downloadUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${await fileResponse.text()}`);
    }
    
    const fileData = await fileResponse.blob();
    
    // Standardize storage path
    const mimeType = message.mime_type || 'application/octet-stream';
    const storagePath = xdelo_validateAndFixStoragePath(message.file_unique_id, mimeType);
    
    // Upload to storage
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }
    
    // Update the message record
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_id: message.file_id, // May have been updated with an alternate ID
        storage_path: storagePath,
        public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`,
        error_message: null,
        error_code: null, 
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        storage_exists: true,
        storage_path_standardized: true
      })
      .eq('id', messageId);
      
    if (updateError) {
      throw new Error(`Failed to update message record: ${updateError.message}`);
    }
    
    return {
      success: true,
      message: 'Successfully redownloaded and updated file',
      data: {
        messageId,
        storagePath,
        fileSize: fileData.size
      }
    };
  } catch (error) {
    console.error('Error in xdelo_retryDownload:', error);
    
    try {
      // Update the message with the error
      await supabase
        .from('messages')
        .update({
          error_message: `Retry download failed: ${error.message}`,
          error_code: error.code || 'RETRY_DOWNLOAD_FAILED',
          redownload_attempts: supabase.rpc('increment', { table: 'messages', column: 'redownload_attempts', id: messageId }),
          last_error_at: new Date().toISOString()
        })
        .eq('id', messageId);
    } catch (updateError) {
      console.error('Failed to update error state:', updateError);
    }
    
    return {
      success: false,
      message: error.message || 'Unknown error during retry download'
    };
  }
}

// Helper to repair media content disposition
export async function xdelo_repairContentDisposition(path: string): Promise<boolean> {
  if (!path) return false;
  
  // Extract bucket name and file path
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  // If no bucket/path provided, return false
  if (!bucket || !filePath) return false;
  
  try {
    // Get file metadata to determine MIME type
    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucket)
      .download(filePath);
      
    if (fileError || !fileData) {
      console.error('Error downloading file for repair:', fileError);
      return false;
    }
    
    // Determine MIME type
    const mimeType = fileData.type || 'application/octet-stream';
    
    // Re-upload with correct content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileData, { ...uploadOptions, upsert: true });
      
    return !uploadError;
  } catch (err) {
    console.error('Error repairing content disposition:', err);
    return false;
  }
}

// Simplified function to download media from Telegram
export async function xdelo_downloadMediaFromTelegram(
  fileId: string, 
  fileUniqueId: string, 
  mimeType: string, 
  telegramBotToken: string
): Promise<{success: boolean, blob?: Blob, storagePath?: string, error?: string}> {
  try {
    // Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`
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
      `https://api.telegram.org/file/bot${telegramBotToken}/${fileInfo.result.file_path}`
    );
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();
    
    // Generate a simplified storage path
    const storagePath = xdelo_validateAndFixStoragePath(fileUniqueId, mimeType);
    
    return {
      success: true,
      blob: fileData,
      storagePath
    };
  } catch (error) {
    console.error(`Error downloading media from Telegram: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Upload media to Supabase storage with proper options
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string
): Promise<{success: boolean, publicUrl?: string, error?: string}> {
  try {
    // Get proper upload options
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    // Upload to storage
    const { data, error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }
    
    // Generate public URL
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`;
    
    return {
      success: true,
      publicUrl
    };
  } catch (error) {
    console.error(`Error uploading media to storage: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function to recover file metadata from Telegram (replacement for recoverFileMetadata)
export async function xdelo_recoverFileMetadata(messageId: string): Promise<{ success: boolean, message: string, data?: any }> {
  try {
    // Get the message with its file_id
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      return {
        success: false,
        message: `Message not found: ${messageError?.message || 'No data returned'}`
      };
    }
    
    if (!message.file_id) {
      return {
        success: false,
        message: 'Message has no file_id for recovery'
      };
    }
    
    // Get the Telegram bot token
    const { data: settings } = await supabase
      .from('settings')
      .select('bot_token')
      .single();
      
    if (!settings?.bot_token) {
      return {
        success: false,
        message: 'Bot token not found in settings'
      };
    }
    
    // Use the existing function to download from Telegram
    const download = await xdelo_downloadMediaFromTelegram(
      message.file_id,
      message.file_unique_id,
      message.mime_type || 'application/octet-stream',
      settings.bot_token
    );
    
    if (!download.success || !download.blob || !download.storagePath) {
      return {
        success: false,
        message: download.error || 'Failed to download from Telegram'
      };
    }
    
    // Upload to storage
    const upload = await xdelo_uploadMediaToStorage(
      download.storagePath,
      download.blob,
      message.mime_type || 'application/octet-stream'
    );
    
    if (!upload.success || !upload.publicUrl) {
      return {
        success: false,
        message: upload.error || 'Failed to upload to storage'
      };
    }
    
    // Update the message with new storage info
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        storage_path: download.storagePath,
        public_url: upload.publicUrl,
        storage_exists: true,
        storage_path_standardized: true,
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        error_message: null,
        error_code: null
      })
      .eq('id', messageId);
      
    if (updateError) {
      return {
        success: false,
        message: `Failed to update message record: ${updateError.message}`
      };
    }
    
    return {
      success: true,
      message: 'Successfully recovered file metadata',
      data: {
        messageId,
        storagePath: download.storagePath,
        publicUrl: upload.publicUrl,
        fileSize: download.blob.size
      }
    };
  } catch (error) {
    console.error('Error in xdelo_recoverFileMetadata:', error);
    return {
      success: false,
      message: error.message || 'Unknown error during metadata recovery'
    };
  }
}
