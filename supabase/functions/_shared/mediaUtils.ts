import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Initialize Supabase client (will use env vars from edge function context)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Standard MIME type map with extensions
const MIME_TYPE_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
  'application/x-tgsticker': 'tgs',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/css': 'css',
  'text/javascript': 'js',
  'application/json': 'json',
  'application/xml': 'xml',
  'application/zip': 'zip',
  'application/octet-stream': 'bin'
};

// Known viewable MIME types
const VIEWABLE_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
  // Videos
  'video/mp4', 'video/webm', 'video/ogg',
  // Audios
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  // Documents
  'application/pdf',
  // Text
  'text/plain', 'text/html', 'text/markdown'
];

/**
 * Determines if a MIME type is viewable in browser (more accurate with expanded list)
 */
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  return VIEWABLE_MIME_TYPES.includes(mimeType) || 
         VIEWABLE_MIME_TYPES.some(type => mimeType.startsWith(type.split('/')[0] + '/'));
}

/**
 * Validates a MIME type against common patterns
 */
export function xdelo_validateMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  
  // Basic pattern validation
  const mimePattern = /^[a-z]+\/[a-z0-9.+-]+$/i;
  if (!mimePattern.test(mimeType)) return false;
  
  // Check against known MIME types
  return Object.keys(MIME_TYPE_MAP).includes(mimeType) || 
         mimeType.includes('/') && ['image', 'video', 'audio', 'text', 'application'].includes(mimeType.split('/')[0]);
}

/**
 * Get default MIME type based on media type
 */
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

/**
 * Enhanced MIME type detection from Telegram media object
 */
export function xdelo_detectMimeType(media: any): string {
  if (!media) return 'application/octet-stream';
  
  // For documents, trust Telegram's MIME type if it's valid
  if (media.document?.mime_type && xdelo_validateMimeType(media.document.mime_type)) {
    return media.document.mime_type;
  }
  
  // Standard mappings for common Telegram media types
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker?.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  
  // Fallback for documents with invalid MIME types
  if (media.document) {
    // Try to infer from file name if available
    if (media.document.file_name) {
      const extension = media.document.file_name.split('.').pop()?.toLowerCase();
      if (extension) {
        // Map common extensions back to MIME types
        const extensionMimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'mp4': 'video/mp4',
          'mov': 'video/quicktime',
          'pdf': 'application/pdf',
          'mp3': 'audio/mpeg',
          'txt': 'text/plain',
          'html': 'text/html',
          'zip': 'application/zip'
        };
        
        if (extensionMimeMap[extension]) {
          return extensionMimeMap[extension];
        }
      }
    }
    
    return 'application/octet-stream';
  }
  
  return 'application/octet-stream';
}

/**
 * Enhanced function to get proper upload options with improved content disposition
 */
export function xdelo_getUploadOptions(mimeType: string): any {
  // Ensure we have a valid MIME type
  const validatedMimeType = xdelo_validateMimeType(mimeType) ? 
    mimeType : 'application/octet-stream';
  
  // Determine if this should be viewed inline or downloaded
  const isViewable = xdelo_isViewableMimeType(validatedMimeType);
  
  // Set content disposition based on viewability
  const contentDisposition = isViewable ? 'inline' : 'attachment';
  
  // Return comprehensive options
  return {
    contentType: validatedMimeType,
    upsert: true,
    cacheControl: '3600',
    contentDisposition: contentDisposition,
    // Store metadata about the upload for debugging
    metadata: {
      originalMimeType: mimeType,
      validatedMimeType: validatedMimeType,
      contentDisposition: contentDisposition,
      uploadTimestamp: new Date().toISOString()
    }
  };
}

/**
 * Improved function to get file extension from MIME type
 */
export function xdelo_getFileExtensionFromMimeType(mimeType: string): string {
  // Normalized mime type
  const normalizedMimeType = mimeType.toLowerCase();
  
  // Use our standard map
  if (MIME_TYPE_MAP[normalizedMimeType]) {
    return MIME_TYPE_MAP[normalizedMimeType];
  }
  
  // Attempt to extract subtype
  const parts = normalizedMimeType.split('/');
  if (parts.length === 2 && parts[1] && !parts[1].includes('x-')) {
    // Use subtype if it doesn't start with x-
    return parts[1];
  }
  
  return 'bin'; // Default extension
}

/**
 * Enhanced storage path validation
 */
export async function xdelo_validateStoragePath(path: string): Promise<boolean> {
  if (!path) return false;
  
  try {
    // Extract bucket name and file path
    const [bucket, ...pathParts] = path.split('/');
    const filePath = pathParts.join('/');
    
    // If no bucket/path provided, return false
    if (!bucket || !filePath) return false;
    
    // Use head request which is more efficient than createSignedUrl
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath, { onlyPath: true });
      
    return !error && !!data;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
  }
}

/**
 * Improved function to generate standardized storage paths
 */
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('Cannot create storage path: missing file_unique_id');
  }
  
  // Validate the file_unique_id to prevent path traversal attacks
  if (fileUniqueId.includes('/') || fileUniqueId.includes('..')) {
    throw new Error('Invalid file_unique_id: contains forbidden characters');
  }
  
  // Ensure we have a valid MIME type to determine extension
  const validatedMimeType = xdelo_validateMimeType(mimeType) ? 
    mimeType : 'application/octet-stream';
  
  // Get appropriate extension
  const extension = xdelo_getFileExtensionFromMimeType(validatedMimeType);
  
  // Create a standardized path: fileUniqueId.extension
  return `${fileUniqueId}.${extension}`;
}

/**
 * Generate public URL for a file that properly respects content disposition
 */
export function xdelo_generatePublicUrl(
  storagePath: string,
  mimeType?: string,
  contentDisposition?: 'inline' | 'attachment'
): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!storagePath || !supabaseUrl) return '';
  
  // Base URL for public access
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${storagePath}`;
  
  // If we know the content disposition preference, and it's attachment (download),
  // we don't need to add parameters since that's the default behavior
  if (contentDisposition === 'attachment') {
    return publicUrl;
  }
  
  // If we have a MIME type and it's viewable, add download=false parameter
  // to encourage inline display
  if (mimeType && xdelo_isViewableMimeType(mimeType)) {
    return `${publicUrl}?download=false`;
  }
  
  return publicUrl;
}

/**
 * Improved function to download media from Telegram with better metadata handling
 */
export async function xdelo_downloadMediaFromTelegram(
  fileId: string, 
  fileUniqueId: string, 
  mimeType: string, 
  telegramBotToken: string
): Promise<{
  success: boolean, 
  blob?: Blob, 
  storagePath?: string, 
  contentDisposition?: 'inline' | 'attachment',
  validatedMimeType?: string,
  error?: string
}> {
  try {
    // Validate MIME type first
    const validatedMimeType = xdelo_validateMimeType(mimeType) ? 
      mimeType : 'application/octet-stream';
    
    // Determine content disposition
    const isViewable = xdelo_isViewableMimeType(validatedMimeType);
    const contentDisposition = isViewable ? 'inline' : 'attachment';
    
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
    
    // Generate a standardized storage path with validated MIME type
    const storagePath = xdelo_validateAndFixStoragePath(fileUniqueId, validatedMimeType);
    
    return {
      success: true,
      blob: fileData,
      storagePath,
      contentDisposition,
      validatedMimeType
    };
  } catch (error) {
    console.error(`Error downloading media from Telegram: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload media to Supabase storage with enhanced metadata and content disposition
 */
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileData: Blob,
  mimeType: string
): Promise<{
  success: boolean, 
  contentDisposition?: 'inline' | 'attachment',
  metadata?: Record<string, any>,
  error?: string
}> {
  try {
    // Get proper upload options with content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    // Upload to storage
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (uploadError) {
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }
    
    return {
      success: true,
      contentDisposition: uploadOptions.contentDisposition,
      metadata: uploadOptions.metadata
    };
  } catch (error) {
    console.error(`Error uploading media to storage: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Helper to repair media content disposition
 */
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

/**
 * Function to retry telegram download for a message
 */
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
    
    // Upload to storage with proper content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }
    
    // Update the message record - remove public_url field
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_id: message.file_id, // May have been updated with an alternate ID
        storage_path: storagePath,
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

/**
 * Helper function

