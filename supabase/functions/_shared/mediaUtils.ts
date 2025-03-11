// @ts-ignore - Allow Deno global
declare const Deno: any;

import { supabaseClient as supabase } from "./supabase.ts";
import { getStoragePublicUrl, getTelegramApiUrl, getTelegramFileUrl } from "./urls.ts";

/**
 * Get extension from MIME type with proper defaults
 */
function xdelo_getExtensionFromMimeType(mimeType: string): string {
  // Standardize mime type to lowercase for comparison
  const normalizedMime = mimeType.toLowerCase();
  
  // Handle common image types first
  if (normalizedMime === 'image/jpeg' || normalizedMime === 'image/jpg') return 'jpeg';
  if (normalizedMime === 'image/png') return 'png';
  if (normalizedMime === 'image/gif') return 'gif';
  if (normalizedMime === 'image/webp') return 'webp';
  
  // Handle video types
  if (normalizedMime === 'video/mp4') return 'mp4';
  if (normalizedMime === 'video/quicktime') return 'mov';
  
  // Handle audio types
  if (normalizedMime === 'audio/mpeg') return 'mp3';
  if (normalizedMime === 'audio/mp4') return 'm4a';
  if (normalizedMime === 'audio/ogg') return 'ogg';
  
  // Handle document types
  if (normalizedMime === 'application/pdf') return 'pdf';
  if (normalizedMime === 'application/x-tgsticker') return 'tgs';
  
  // Extract extension from mime type if possible
  const parts = normalizedMime.split('/');
  if (parts.length === 2 && parts[1] !== 'octet-stream') {
    return parts[1];
  }
  
  // Default to bin for unknown types
  return 'bin';
}

/**
 * Get default MIME type based on media type string
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
    case 'animation':
      return 'video/mp4';
    case 'document':
    default:
      return 'application/octet-stream';
  }
}

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

// Determine if a MIME type is viewable in browser
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return /^(image\/|video\/|audio\/|text\/|application\/pdf)/.test(mimeType);
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

// Get media info from a Telegram message
export async function xdelo_getMediaInfoFromTelegram(message: any, correlationId: string = crypto.randomUUID()): Promise<any> {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  const video = message.video;
  const document = message.document;
  
  const media = photo || video || document;
  if (!media) throw new Error('No media found in message');

  // Determine the MIME type
  const mediaObj = { photo, video, document };
  const mimeType = xdelo_detectMimeType(mediaObj);
  
  // Generate standardized storage path
  const fileName = xdelo_constructStoragePath(media.file_unique_id, mimeType);
  
  // Check for existing file using file_unique_id
  const { data: existingFile } = await supabase
    .from('messages')
    .select('id, file_unique_id, storage_path, public_url, mime_type, file_id_expires_at, original_file_id')
    .eq('file_unique_id', media.file_unique_id)
    .eq('deleted_from_telegram', false)
    .limit(1);

  // Always download from Telegram and upload to ensure we have the latest version
  try {
    const fileInfoResponse = await fetch(getTelegramApiUrl(`getFile?file_id=${media.file_id}`));
    
    if (!fileInfoResponse.ok) {
      throw new Error(`Failed to get file info from Telegram: ${await fileInfoResponse.text()}`);
    }
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(fileInfo)}`);
    }

    const fileDataResponse = await fetch(getTelegramFileUrl(fileInfo.result.file_path));
    
    if (!fileDataResponse.ok) {
      throw new Error(`Failed to download file from Telegram: ${await fileDataResponse.text()}`);
    }
    
    const fileData = await fileDataResponse.blob();

    // Upload to Supabase Storage with correct content type
    const { success, publicUrl } = await xdelo_uploadMediaToStorage(
      fileData,
      fileName,
      mimeType
    );

    if (!success || !publicUrl) {
      throw new Error('Failed to upload media to storage');
    }

    // Return full info including duplicate status and file expiration
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      is_duplicate: existingFile && existingFile.length > 0,
      original_message_id: existingFile && existingFile.length > 0 ? existingFile[0].id : undefined,
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      original_file_id: media.file_id // Store the original file_id for reference
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails but we have file info, return placeholder data
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: getStoragePublicUrl(fileName),
      needs_redownload: true,
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      original_file_id: media.file_id,
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
    
    // Always download from Telegram (no storage checks)
    
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
    
    // Ensure we have a valid mime type
    const mimeType = message.mime_type || 'application/octet-stream';
    
    // Generate standardized storage path
    const fileName = xdelo_constructStoragePath(message.file_unique_id, mimeType);

    // Upload to storage with correct content disposition
    const { success, publicUrl } = await xdelo_uploadMediaToStorage(
      fileData,
      fileName,
      mimeType
    );

    if (!success || !publicUrl) {
      throw new Error('Failed to upload media to storage during redownload');
    }

    // Return success information
    return {
      success: true,
      message_id: message.id,
      file_unique_id: message.file_unique_id,
      storage_path: fileName,
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

