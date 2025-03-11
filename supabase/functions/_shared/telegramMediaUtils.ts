
// Telegram media utilities
// @ts-ignore - Allow Deno global
declare const Deno: any;

import { supabaseClient as supabase } from "./supabase.ts";
import { getTelegramApiUrl, getTelegramFileUrl, getStoragePublicUrl } from "./urls.ts";
import { xdelo_detectMimeType } from "./mimeUtils.ts";
import { 
  xdelo_constructStoragePath, 
  xdelo_uploadMediaToStorage 
} from "./storageUtils.ts";
import { xdelo_logMediaRedownload } from "./messageLogger.ts";

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
