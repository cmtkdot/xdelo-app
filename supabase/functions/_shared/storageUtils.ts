
// Storage operations utilities
// @ts-ignore - Allow Deno global
declare const Deno: any;

import { supabaseClient as supabase } from "./supabase.ts";
import { getStoragePublicUrl } from "./urls.ts";
import { xdelo_getExtensionFromMimeType } from "./mimeUtils.ts";

// Construct standardized storage path with proper extension handling
export function xdelo_constructStoragePath(fileUniqueId: string, mimeType: string): string {
  const ext = xdelo_getExtensionFromMimeType(mimeType);
  return `${fileUniqueId}.${ext}`;
}

// Get upload options including correct content type
export function xdelo_getUploadOptions(mimeType: string): any {
  return {
    contentType: mimeType || 'application/octet-stream',
    contentDisposition: 'inline', // Always set to inline for better browser viewing
    upsert: true // Always replace existing files
  };
}

// Upload media to Supabase Storage
export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string,
  mimeType: string
): Promise<{success: boolean, publicUrl?: string}> {
  try {
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    const { error } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (error) throw error;
    
    // Generate public URL
    const publicUrl = getStoragePublicUrl(storagePath);
    
    return { success: true, publicUrl };
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return { success: false };
  }
}

// Check if file exists in storage
export async function xdelo_validateStoragePath(path: string): Promise<boolean> {
  if (!path) return false;
  
  // Extract bucket name and file path
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

// Check if a file exists directly in the storage bucket
export async function xdelo_checkFileExistsInStorage(fileUniqueId: string, mimeType: string): Promise<boolean> {
  try {
    // Generate the standardized path
    const storagePath = xdelo_constructStoragePath(fileUniqueId, mimeType);
    
    // Try to download a single byte of the file to check its existence
    const { data, error } = await supabase
      .storage
      .from('telegram-media')
      .download(storagePath, { range: { offset: 0, length: 1 } });
    
    return !error && !!data;
  } catch (error) {
    console.error('Error checking file existence in storage:', error);
    return false;
  }
}

// Repair content disposition for a file (re-upload with correct content type)
export async function xdelo_repairContentDisposition(storagePath: string, mimeType?: string): Promise<boolean> {
  try {
    // Extract bucket and path
    const [bucket, ...pathParts] = storagePath.split('/');
    const path = pathParts.join('/');
    
    if (!bucket || !path) return false;
    
    // Download the existing file
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .download(path);
      
    if (error || !data) return false;
    
    // If no mime type provided, try to infer from path
    const actualMimeType = mimeType || `image/${path.split('.').pop()}`;
    
    // Re-upload with correct content type
    const uploadOptions = xdelo_getUploadOptions(actualMimeType);
    const { error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(path, data, uploadOptions);
      
    return !uploadError;
  } catch (error) {
    console.error('Error repairing content disposition:', error);
    return false;
  }
}

// Check if a URL exists (returns non-404)
export async function xdelo_urlExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.status !== 404;
  } catch (error) {
    console.error('Error checking URL existence:', error);
    return false;
  }
}
