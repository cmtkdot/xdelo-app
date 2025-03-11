
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (will use env vars from edge function context)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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

// Upload media to Supabase Storage
export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string,
  mimeType: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true
      });
      
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
      .list(filePath.split('/').slice(0, -1).join('/'), {
        limit: 1,
        search: filePath.split('/').pop() || ''
      });
      
    return !error && data && data.length > 0;
  } catch (err) {
    console.error('Error validating storage path:', err);
    return false;
  }
}
