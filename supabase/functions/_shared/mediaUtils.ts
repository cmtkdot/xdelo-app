
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (will use env vars from edge function context)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Helper to determine if the MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  // Enhanced to include more viewable types
  return /^(image\/|video\/|text\/|application\/pdf)/.test(mimeType);
}

// Get default MIME type based on media type
export function xdelo_getDefaultMimeType(media: any): string {
  if (media.photo) return 'image/jpeg';
  if (media.video) return 'video/mp4';
  if (media.audio) return 'audio/mpeg';
  if (media.voice) return 'audio/ogg';
  if (media.animation) return 'video/mp4';
  if (media.sticker && media.sticker.is_animated) return 'application/x-tgsticker';
  if (media.sticker) return 'image/webp';
  return 'application/octet-stream';
}

// Detect MIME type from Telegram media object
export function xdelo_detectMimeType(media: any): string {
  // Try to extract from the media object directly
  if (media.document?.mime_type) return media.document.mime_type;
  if (media.video?.mime_type) return media.video.mime_type;
  if (media.audio?.mime_type) return media.audio.mime_type;
  if (media.voice?.mime_type) return media.voice.mime_type;
  
  // Use default MIME type based on media type
  return xdelo_getDefaultMimeType(media);
}

// Helper to get proper upload options based on MIME type
export function xdelo_getUploadOptions(mimeType: string): any {
  // Default options for all uploads
  const options = {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
    // Always set contentDisposition based on mime type
    contentDisposition: xdelo_isViewableMimeType(mimeType) ? 'inline' : 'attachment'
  };
  
  return options;
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
    // Check if file exists
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(filePath.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: filePath.split('/').pop() || ''
      });
      
    return !error && !!data?.length;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
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
