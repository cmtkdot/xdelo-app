
import { supabase } from '@/integrations/supabase/client';

/**
 * Determines if a MIME type is viewable in browser
 */
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return /^(image\/|video\/|text\/|application\/pdf)/.test(mimeType);
}

/**
 * Gets upload options with proper content disposition based on MIME type
 */
export function xdelo_getUploadOptions(mimeType: string): any {
  return {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
    contentDisposition: xdelo_isViewableMimeType(mimeType) ? 'inline' : 'attachment'
  };
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
 * Uploads media to storage with proper MIME type handling and standardized paths
 */
export async function xdelo_uploadTelegramMedia(
  fileUrl: string, 
  fileUniqueId: string, 
  mediaType: string, 
  explicitMimeType?: string
): Promise<{publicUrl: string, storagePath: string}> {
  // Determine MIME type with fallback to default based on media type
  const mimeType = explicitMimeType || xdelo_getDefaultMimeType(mediaType);
  console.log('📤 Uploading media to storage:', { fileUniqueId, mediaType, mimeType });
  
  // Generate standardized storage path
  const storagePath = xdelo_constructStoragePath(fileUniqueId, mimeType);
  
  try {
    // Download media from source URL
    const mediaResponse = await fetch(fileUrl);
    if (!mediaResponse.ok) {
      throw new Error(`Failed to download media: ${mediaResponse.status} ${mediaResponse.statusText}`);
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer();

    // Upload with proper content disposition based on MIME type
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, uploadOptions);

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    console.log('✅ Media uploaded successfully:', publicUrl);
    return { publicUrl, storagePath };

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
    // Extract bucket and path
    const parts = storagePath.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');
    
    if (!bucket || !path) return false;
    
    // Check if file exists using head request
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .download(path, { range: { offset: 0, length: 1 } });
      
    return !error && !!data;
  } catch (error) {
    console.error('Error validating storage file:', error);
    return false;
  }
}

/**
 * Repairs content disposition for an existing file
 */
export async function xdelo_repairContentDisposition(storagePath: string, mimeType: string): Promise<boolean> {
  try {
    // Extract bucket and path
    const parts = storagePath.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');
    
    if (!bucket || !path) return false;
    
    // Download the existing file
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .download(path);
      
    if (error || !data) return false;
    
    // Re-upload with proper content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    const { error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(path, data, { ...uploadOptions, upsert: true });
      
    return !uploadError;
  } catch (error) {
    console.error('Error repairing content disposition:', error);
    return false;
  }
}
