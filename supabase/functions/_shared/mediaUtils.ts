import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Initialize Supabase client (will use env vars from edge function context)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Enhanced detection of MIME type from Telegram media object
export function xdelo_detectMimeType(media: any): string {
  // Try to extract from the media object directly
  if (media.document?.mime_type) return media.document.mime_type;
  if (media.video?.mime_type) return media.video.mime_type;
  if (media.audio?.mime_type) return media.audio.mime_type;
  if (media.voice?.mime_type) return media.voice.mime_type;
  
  // Default MIME types based on media type
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker && media.sticker.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  
  return 'application/octet-stream';
}

// Construct standardized storage path
export function xdelo_constructStoragePath(fileUniqueId: string, mimeType: string): string {
  // Get file extension from MIME type
  const ext = mimeType.split('/')[1] || 'bin';
  return `${fileUniqueId}.${ext}`;
}

// Get upload options including correct content type
export function xdelo_getUploadOptions(mimeType: string): any {
  return {
    contentType: mimeType,
    upsert: true // Always replace existing files
  };
}

// Upload media to Supabase Storage
export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string,
  mimeType: string
): Promise<boolean> {
  try {
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    const { error } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    return !error;
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return false;
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

// Determine if a MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return /^(image\/|video\/|audio\/|text\/|application\/pdf)/.test(mimeType);
}
