
import { supabase } from '@/integrations/supabase/client';

/**
 * Determines if a file extension is viewable in browser
 */
export function xdelo_isViewableExtension(extension: string): boolean {
  const viewableExtensions = [
    'jpeg', 'jpg', 'png', 'gif', 'webp', 'svg',
    'mp4', 'mov', 'webm',
    'mp3', 'ogg', 'wav',
    'pdf'
  ];
  return viewableExtensions.includes(extension.toLowerCase());
}

/**
 * Get file extension based on media type
 */
export function xdelo_getFileExtension(mediaType: string): string {
  switch (mediaType) {
    case 'photo':
      return 'jpeg';
    case 'video':
      return 'mp4';
    case 'audio':
      return 'mp3';
    case 'voice':
      return 'ogg';
    case 'sticker':
      return 'webp';
    case 'animation':
      return 'mp4';
    case 'document':
    default:
      return 'bin';
  }
}

/**
 * Helper function to validate and sanitize extensions
 */
export function xdelo_getSafeExtension(extension?: string, mediaType?: string): string {
  if (!extension || extension === 'bin') {
    return mediaType ? xdelo_getFileExtension(mediaType) : 'bin';
  }
  
  // Only allow valid extensions (alphanumeric, 1-5 chars)
  if (/^[a-z0-9]{1,5}$/i.test(extension)) {
    return extension.toLowerCase();
  }
  
  return mediaType ? xdelo_getFileExtension(mediaType) : 'bin';
}

/**
 * Get MIME type from extension or mediaType
 */
export function xdelo_getMimeType(extension: string, mediaType?: string): string {
  // Comprehensive map of extensions to MIME types
  const mimeMap: Record<string, string> = {
    // Images
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    
    // Audio
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    
    // Telegram specific
    'tgs': 'application/gzip', // Telegram animated stickers
  };

  // Get MIME type from extension or use a generic fallback with the extension
  const mimeType = mimeMap[extension.toLowerCase()];
  
  if (mimeType) {
    return mimeType;
  }
  
  // If we don't have a mapping but have a mediaType, use that to determine a generic MIME type
  if (mediaType) {
    if (mediaType.includes('photo')) return 'image/jpeg';
    if (mediaType.includes('video')) return 'video/mp4';
    if (mediaType.includes('audio')) return 'audio/mpeg';
    if (mediaType.includes('voice')) return 'audio/ogg';
  }
  
  // Generic fallback
  return `application/${extension}`;
}

/**
 * Construct standardized storage path for a media file
 */
export function xdelo_constructStoragePath(fileUniqueId: string, extension: string): string {
  return `${fileUniqueId}.${extension}`;
}

/**
 * Directly check if a file exists in storage by fileUniqueId
 */
export async function xdelo_checkFileExistsInStorage(fileUniqueId: string, extension: string): Promise<boolean> {
  try {
    const storagePath = xdelo_constructStoragePath(fileUniqueId, extension);
    
    // Try to get file metadata to check existence
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .list('', {
        search: storagePath
      });
      
    return !error && data && data.length > 0;
  } catch (error) {
    console.error('Error checking file in storage:', error);
    return false;
  }
}

/**
 * Uploads media to storage with proper extension handling and standardized paths
 * Always re-uploads media to replace existing files
 */
export async function xdelo_uploadTelegramMedia(
  fileUrl: string, 
  fileUniqueId: string, 
  mediaType: string, 
  explicitExtension?: string
): Promise<{publicUrl: string, storagePath: string, mimeType: string}> {
  // Get extension from explicit param or fallback to media type extension
  const extension = xdelo_getSafeExtension(explicitExtension, mediaType);
  console.log('📤 Uploading media to storage:', { fileUniqueId, mediaType, extension });
  
  // Call the media-management edge function to handle the upload
  try {
    const { data, error } = await supabase.functions.invoke('media-management', {
      body: { 
        action: 'upload',
        fileUrl,
        fileUniqueId,
        mediaType,
        extension
      }
    });
    
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error || 'Upload failed');
    
    console.log('✅ Media uploaded successfully:', data.publicUrl);
    return { 
      publicUrl: data.publicUrl, 
      storagePath: data.storagePath,
      mimeType: data.mimeType || xdelo_getMimeType(extension, mediaType) // Get MIME type from response or calculate it
    };
  } catch (error) {
    console.error('❌ Error uploading media:', error);
    throw error;
  }
}

/**
 * Validates if a file exists in storage
 */
export async function xdelo_validateStorageFile(storagePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('media-management', {
      body: { 
        action: 'validate',
        storagePath
      }
    });
    
    if (error) throw new Error(error.message);
    return data.success && data.exists;
  } catch (error) {
    console.error('Error validating storage file:', error);
    return false;
  }
}

/**
 * Repairs content disposition for an existing file by re-uploading with inline content disposition
 */
export async function xdelo_repairContentDisposition(storagePath: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('media-management', {
      body: { 
        action: 'repair',
        storagePath
      }
    });
    
    if (error) throw new Error(error.message);
    return data.success;
  } catch (error) {
    console.error('Error updating file content type:', error);
    return false;
  }
}
