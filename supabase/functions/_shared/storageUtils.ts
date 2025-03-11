
import { supabaseClient as supabase } from "./supabase.ts";
import { getStoragePublicUrl } from "./urls.ts";

/**
 * Upload media to storage with automatic content type handling
 */
export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string
): Promise<{success: boolean, publicUrl?: string}> {
  try {
    // Upload to storage with upsert enabled, let Supabase handle content type
    const { error } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        upsert: true // Always enable overwriting existing files
      });
      
    if (error) throw error;
    
    // Generate public URL
    const publicUrl = getStoragePublicUrl(storagePath);
    
    return { success: true, publicUrl };
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return { success: false };
  }
}

/**
 * Check if file exists in storage
 */
export async function xdelo_validateStoragePath(path: string): Promise<boolean> {
  if (!path) return false;
  
  const [bucket, ...pathParts] = path.split('/');
  const filePath = pathParts.join('/');
  
  if (!bucket || !filePath) return false;
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath, { range: { offset: 0, length: 1 } });
      
    return !error && !!data;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
  }
}

/**
 * Check if a file exists directly in the storage bucket
 */
export async function xdelo_checkFileExistsInStorage(fileUniqueId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .list('', {
        search: fileUniqueId
      });
    
    return !error && data && data.length > 0;
  } catch (error) {
    console.error('Error checking file existence in storage:', error);
    return false;
  }
}

/**
 * Construct a standardized storage path for a file
 */
export function xdelo_constructStoragePath(fileUniqueId: string, fileType: string): string {
  const extension = fileType.split('/')[1] || 'bin';
  return `${fileUniqueId}.${extension}`;
}

/**
 * Get upload options with upsert always enabled
 */
export function xdelo_getUploadOptions(_mimeType?: string): { upsert: boolean } {
  // Always use upsert: true and let Supabase determine content type
  return { upsert: true };
}

/**
 * Check if a URL exists and is accessible
 */
export async function xdelo_urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}
