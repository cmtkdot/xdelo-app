
import { supabase } from '@/integrations/supabase/client';

/**
 * Determines if a file extension is viewable in browser
 */
export function xdelo_isViewableExtension(extension: string): boolean {
  const viewableExtensions = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'pdf'];
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
    case 'document':
    default:
      return 'bin';
  }
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
 * Uploads media to storage with proper MIME type handling and standardized paths
 * Always re-uploads media to replace existing files
 */
export async function xdelo_uploadTelegramMedia(
  fileUrl: string, 
  fileUniqueId: string, 
  mediaType: string, 
  explicitMimeType?: string
): Promise<{publicUrl: string, storagePath: string, mimeType: string}> {
  // Get extension from explicit MIME type or fallback to media type extension
  const extension = explicitMimeType ? explicitMimeType.split('/')[1] || 'bin' : xdelo_getFileExtension(mediaType);
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
      mimeType: data.mimeType
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
