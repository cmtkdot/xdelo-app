// @ts-ignore - Allow Deno global
declare const Deno: any;

import { supabaseClient as supabase } from "./supabase.ts";
import { getStoragePublicUrl, getTelegramApiUrl, getTelegramFileUrl } from "./urls.ts";

/**
 * Get file extension based on media type or filename
 * This is used when no explicit extension is available
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
    case 'animation':
      return 'mp4';
    case 'document':
    default:
      return 'bin';
  }
}

// Extract file extension from Telegram media object
export function xdelo_getExtensionFromMedia(media: any): string {
  // Try to extract extension from mime_type if available
  if (media.document?.mime_type) {
    const parts = media.document.mime_type.split('/');
    if (parts.length === 2 && parts[1] !== 'octet-stream') {
      return parts[1];
    }
  }
  if (media.video?.mime_type) {
    const parts = media.video.mime_type.split('/');
    if (parts.length === 2 && parts[1] !== 'octet-stream') {
      return parts[1];
    }
  }
  if (media.audio?.mime_type) {
    const parts = media.audio.mime_type.split('/');
    if (parts.length === 2 && parts[1] !== 'octet-stream') {
      return parts[1];
    }
  }
  if (media.voice?.mime_type) {
    const parts = media.voice.mime_type.split('/');
    if (parts.length === 2 && parts[1] !== 'octet-stream') {
      return parts[1];
    }
  }
  
  // Fallback to media type detection
  if (media.photo) return 'jpeg';
  if (media.video) return 'mp4';
  if (media.audio) return 'mp3';
  if (media.voice) return 'ogg';
  if (media.animation) return 'mp4';
  if (media.sticker && media.sticker.is_animated) return 'tgs';
  if (media.sticker) return 'webp';
  
  return 'bin';
}

// Construct standardized storage path with just the file extension
export function xdelo_constructStoragePath(fileUniqueId: string, extension: string): string {
  return `${fileUniqueId}.${extension}`;
}

// Get upload options with explicit content type mapping
export function xdelo_getUploadOptions(extension: string): any {
  // Map common extensions to proper MIME types
  const mimeMap: Record<string, string> = {
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'zip': 'application/zip',
    'tgs': 'application/gzip',
  };

  return {
    contentType: mimeMap[extension.toLowerCase()] || `application/${extension}`,
    contentDisposition: 'inline', // Always set to inline for better browser viewing
    upsert: true // Always replace existing files
  };
}

// Upload media to Supabase Storage with explicit content type based on extension
export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string
): Promise<{success: boolean, publicUrl?: string}> {
  try {
    const extension = storagePath.split('.').pop()?.toLowerCase() || 'bin';
    const uploadOptions = xdelo_getUploadOptions(extension);
    
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
export async function xdelo_checkFileExistsInStorage(fileUniqueId: string, extension: string): Promise<boolean> {
  try {
    // Generate the standardized path
    const storagePath = xdelo_constructStoragePath(fileUniqueId, extension);
    
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

// Repair content disposition for a file (re-upload with inline disposition)
export async function xdelo_repairContentDisposition(storagePath: string): Promise<boolean> {
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
    
    // Extract extension for content type
    const extension = path.split('.').pop()?.toLowerCase() || 'bin';
    
    // Re-upload with correct content disposition and content type
    const uploadOptions = xdelo_getUploadOptions(extension);
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

// Determine if an extension is viewable in browser
export function xdelo_isViewableExtension(extension: string): boolean {
  const viewableExtensions = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm', 'pdf'];
  return viewableExtensions.includes(extension.toLowerCase());
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

// Get media info from a Telegram message with proper content type handling
export async function xdelo_getMediaInfoFromTelegram(message: any, correlationId: string = crypto.randomUUID()): Promise<any> {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  const video = message.video;
  const document = message.document;
  
  const media = photo || video || document;
  if (!media) throw new Error('No media found in message');

  // Extract file extension from media
  const mediaObj = { photo, video, document };
  const extension = xdelo_getExtensionFromMedia(mediaObj);
  
  // Generate standardized storage path using just the extension
  const storagePath = xdelo_constructStoragePath(media.file_unique_id, extension);
  
  // Always download from Telegram and upload (regardless if it exists)
  try {
    // Get file info from Telegram
    const fileInfoResponse = await fetch(getTelegramApiUrl(`getFile?file_id=${media.file_id}`));
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }

    // Download file from Telegram
    const fileDataResponse = await fetch(getTelegramFileUrl(fileInfo.result.file_path));
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Upload to Supabase Storage with proper content type
    const { success, publicUrl } = await xdelo_uploadMediaToStorage(
      fileData,
      storagePath
    );

    if (!success || !publicUrl) {
      throw new Error('Failed to upload media to storage');
    }

    // Return full info
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: storagePath,
      public_url: publicUrl
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails but we know the file info, return placeholder data and mark for redownload
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: storagePath,
      public_url: getStoragePublicUrl(storagePath),
      needs_redownload: true,
      error: error.message
    };
  }
}

// Enhanced function to redownload missing files from Telegram
export async function xdelo_redownloadMissingFile(message: any, correlationId: string = crypto.randomUUID()): Promise<any> {
  try {
    console.log('Attempting to redownload file for message:', message.id);
    
    if (!message.file_id) {
      throw new Error('Missing file_id for redownload');
    }
    
    // Get file info from Telegram
    const fileInfoResponse = await fetch(getTelegramApiUrl(`getFile?file_id=${message.file_id}`));
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }

    // Download file from Telegram
    const fileDataResponse = await fetch(getTelegramFileUrl(fileInfo.result.file_path));
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();
    
    // Extract file extension from storage path
    const extension = message.storage_path.split('.').pop() || 'bin';
    
    // Generate standardized storage path
    const storagePath = xdelo_constructStoragePath(message.file_unique_id, extension);

    // Upload to storage with inline content disposition
    const { success, publicUrl } = await xdelo_uploadMediaToStorage(
      fileData,
      storagePath
    );

    if (!success || !publicUrl) {
      throw new Error('Failed to upload media to storage during redownload');
    }

    // Return success information
    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: storagePath,
      public_url: publicUrl,
      method: 'telegram_api'
    };
  } catch (error) {
    console.error('Failed to redownload file:', error);
    
    return {
      success: false,
      message_id: message.id,
      error: error.message
    };
  }
}

// For backward compatibility - will be removed in future update
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  const viewableMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf'
  ];
  return viewableMimeTypes.includes(mimeType);
}
