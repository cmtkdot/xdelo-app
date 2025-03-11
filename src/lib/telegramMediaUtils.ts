
import { supabase } from '@/integrations/supabase/client';

/**
 * Determines if a MIME type is viewable in browser
 */
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return /^(image\/|video\/|text\/|application\/pdf)/.test(mimeType);
}

/**
 * Get default MIME type based on media type
 */
export function xdelo_getDefaultMimeType(mediaType: string): string {
  switch (mediaType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'audio':
      return 'audio/mpeg';
    case 'voice':
      return 'audio/ogg';
    case 'document':
    default:
      return 'application/octet-stream';
  }
}

/**
 * Construct standardized storage path for a media file
 */
export function xdelo_constructStoragePath(fileUniqueId: string, mimeType: string): string {
  const ext = mimeType.split('/')[1] || 'bin';
  return `${fileUniqueId}.${ext}`;
}

/**
 * Directly check if a file exists in storage by fileUniqueId
 */
export async function xdelo_checkFileExistsInStorage(fileUniqueId: string, mimeType: string): Promise<boolean> {
  try {
    const storagePath = xdelo_constructStoragePath(fileUniqueId, mimeType);
    
    // Try to download just 1 byte to check existence
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .download(storagePath, { range: { offset: 0, length: 1 } });
      
    return !error && !!data;
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
  // Determine MIME type with fallback to default based on media type
  const mimeType = explicitMimeType || xdelo_getDefaultMimeType(mediaType);
  console.log('📤 Uploading media to storage:', { fileUniqueId, mediaType, mimeType });
  
  // Call the media-management edge function to handle the upload
  try {
    const { data, error } = await supabase.functions.invoke('media-management', {
      body: { 
        action: 'upload',
        fileUrl,
        fileUniqueId,
        mediaType,
        mimeType
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
 * Repairs content disposition for an existing file by re-uploading with correct content type
 */
export async function xdelo_repairContentDisposition(storagePath: string, mimeType: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('media-management', {
      body: { 
        action: 'repair',
        storagePath,
        mimeType
      }
    });
    
    if (error) throw new Error(error.message);
    return data.success;
  } catch (error) {
    console.error('Error updating file content type:', error);
    return false;
  }
}
