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
    case 'sticker':
      return 'webp'; // Default sticker format
    case 'document':
    default:
      return 'bin';
  }
}

// Extract file extension from Telegram media object with improved detection
export function xdelo_getExtensionFromMedia(media: any): string {
  // Try to extract extension from mime_type if available
  if (media.document?.mime_type) {
    const parts = media.document.mime_type.split('/');
    if (parts.length === 2 && parts[1] !== 'octet-stream') {
      return parts[1];
    }
    // For documents, try to extract from file_name if available
    if (media.document.file_name) {
      const nameParts = media.document.file_name.split('.');
      if (nameParts.length > 1) {
        const ext = nameParts.pop()?.toLowerCase();
        if (ext && ext.length > 0 && ext.length < 5) { // Reasonable extension length
          return ext;
        }
      }
    }
  }
  if (media.video?.mime_type) {
    // Force video files to mp4 for consistency
    return 'mp4';
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
  if (media.sticker) {
    if (media.sticker.is_animated) return 'tgs';
    if (media.sticker.is_video) return 'webm';
    return 'webp';
  }
  
  // Fallback to media type detection
  if (media.photo) return 'jpeg'; // Force photos to jpeg
  if (media.video) return 'mp4'; // Force videos to mp4
  if (media.audio) return 'mp3';
  if (media.voice) return 'ogg';
  if (media.animation) return 'mp4';
  
  return 'bin';
}

// Construct standardized storage path with just the file extension
export function xdelo_constructStoragePath(fileUniqueId: string, extension: string): string {
  return `${fileUniqueId}.${extension}`;
}

// Get upload options with explicit content type mapping
export function xdelo_getUploadOptions(extension: string): any {
  // Expanded map of common extensions to proper MIME types
  const mimeMap: Record<string, string> = {
    // Images
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'heic': 'image/heic',
    
    // Videos - Always standardize to mp4
    'mp4': 'video/mp4',
    'mov': 'video/mp4', // Convert to mp4 content type
    'webm': 'video/webm',
    'mkv': 'video/mp4', // Convert to mp4 content type
    'avi': 'video/mp4', // Convert to mp4 content type
    '3gp': 'video/mp4', // Convert to mp4 content type
    
    // Audio
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Telegram specific
    'tgs': 'application/gzip', // Telegram animated stickers
  };

  // Get proper content type or use a safe default with the extension
  const contentType = mimeMap[extension.toLowerCase()] || `application/${extension}`;
  
  // Determine if this is a viewable media type
  const isViewable = xdelo_isViewableExtension(extension);
  
  // Add caching headers for static content
  const cacheControl = isViewable ? 'public, max-age=31536000' : 'no-cache';

  return {
    contentType,
    contentDisposition: 'inline', // Always set to inline for better browser viewing
    upsert: true, // Always replace existing files
    cacheControl
  };
}

// Upload media to Supabase Storage with explicit content type based on extension
export async function xdelo_uploadMediaToStorage(
  fileData: Blob,
  storagePath: string
): Promise<{success: boolean, publicUrl?: string, mimeType?: string}> {
  try {
    // Extract extension from storage path
    const extension = storagePath.split('.').pop()?.toLowerCase() || 'bin';
    const uploadOptions = xdelo_getUploadOptions(extension);
    
    console.log(`Uploading file to ${storagePath} with content type: ${uploadOptions.contentType}`);
    
    const { error } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (error) throw error;
    
    // Generate public URL
    const publicUrl = getStoragePublicUrl(storagePath);
    
    return { 
      success: true, 
      publicUrl,
      mimeType: uploadOptions.contentType
    };
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

/**
 * Determine if an extension is viewable in browser
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
  const sticker = message.sticker;
  const animation = message.animation;
  const voice = message.voice;
  const audio = message.audio;
  
  const media = photo || video || document || sticker || animation || voice || audio;
  if (!media) throw new Error('No media found in message');

  // Extract file extension from media with improved detection
  const mediaObj = { photo, video, document, sticker, animation, voice, audio };
  let extension = xdelo_getExtensionFromMedia(mediaObj);
  
  // Force specific extensions for standardization
  if (photo) {
    extension = 'jpeg'; // Always use jpeg for photos
  } else if (video) {
    extension = 'mp4'; // Always use mp4 for videos
  }
  
  console.log(`Detected extension for media: ${extension}`);
  
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

    // Extract actual extension from Telegram path if available
    let finalExtension = extension;
    if (fileInfo.result.file_path) {
      const pathParts = fileInfo.result.file_path.split('.');
      if (pathParts.length > 1) {
        const telegramExt = pathParts.pop()?.toLowerCase();
        if (telegramExt && telegramExt.length > 0 && telegramExt.length < 5) {
          console.log(`Using extension from Telegram path: ${telegramExt}`);
          // Only use Telegram's extension if it's not a photo or video (which we standardize)
          if (!photo && !video) {
            finalExtension = telegramExt;
          }
        }
      }
    }
    
    // Re-compute storage path with possibly updated extension
    const finalStoragePath = xdelo_constructStoragePath(media.file_unique_id, finalExtension);

    // Upload to Supabase Storage with proper content type
    const { success, publicUrl, mimeType } = await xdelo_uploadMediaToStorage(
      fileData,
      finalStoragePath
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
      duration: video?.duration || animation?.duration || voice?.duration || audio?.duration,
      storage_path: finalStoragePath,
      public_url: publicUrl,
      mime_type: mimeType,
      extension: finalExtension
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
      duration: video?.duration || animation?.duration || voice?.duration || audio?.duration,
      storage_path: storagePath,
      public_url: getStoragePublicUrl(storagePath),
      needs_redownload: true,
      error: error.message,
      extension
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
    
    // Try to determine extension from Telegram file path
    let extension = message.storage_path?.split('.').pop() || 'bin';
    
    // Force specific extensions for standardization based on media_type property
    if (message.media_type === 'photo') {
      extension = 'jpeg';
    } else if (message.media_type === 'video') {
      extension = 'mp4';
    } else if (fileInfo.result.file_path) {
      const pathParts = fileInfo.result.file_path.split('.');
      if (pathParts.length > 1) {
        const telegramExt = pathParts.pop()?.toLowerCase();
        if (telegramExt && telegramExt.length > 0 && telegramExt.length < 5) {
          extension = telegramExt;
        }
      }
    }
    
    // Generate standardized storage path
    const storagePath = xdelo_constructStoragePath(message.file_unique_id, extension);

    // Upload to storage with inline content disposition
    const { success, publicUrl, mimeType } = await xdelo_uploadMediaToStorage(
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
      method: 'telegram_api',
      mime_type: mimeType,
      extension
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

// Determine if an extension is viewable in browser
export function xdelo_isViewableExtension(extension: string): boolean {
  const viewableExtensions = [
    'jpeg', 'jpg', 'png', 'gif', 'webp', 'svg',
    'mp4', 'mov', 'webm',
    'mp3', 'ogg', 'wav',
    'pdf'
  ];
  return viewableExtensions.includes(extension.toLowerCase());
}

// For backward compatibility - will be removed in future update
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  const viewableMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/ogg', 'audio/wav',
    'application/pdf'
  ];
  return viewableMimeTypes.includes(mimeType);
}
