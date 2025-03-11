
import { supabaseClient as supabase } from "./supabase.ts";
import { getTelegramApiUrl, getTelegramFileUrl, getStoragePublicUrl } from "./urls.ts";
import { xdelo_uploadMediaToStorage } from "./storageUtils.ts";
import { xdelo_logMediaRedownload } from "./messageLogger.ts";

// Get media info from a Telegram message
export async function xdelo_getMediaInfoFromTelegram(message: any, correlationId: string = crypto.randomUUID()): Promise<any> {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  const video = message.video;
  const document = message.document;
  
  const media = photo || video || document;
  if (!media) throw new Error('No media found in message');

  // Get file info from Telegram
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
    const extension = fileData.type.split('/')[1] || 'bin';
    const fileName = `${media.file_unique_id}.${extension}`;

    // Upload to storage with upsert enabled
    const { success, publicUrl } = await xdelo_uploadMediaToStorage(fileData, fileName);

    if (!success || !publicUrl) {
      throw new Error('Failed to upload media to storage');
    }

    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: fileName,
      public_url: publicUrl,
      file_id_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      original_file_id: media.file_id
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      file_size: media.file_size,
      width: media.width,
      height: media.height,
      duration: video?.duration,
      storage_path: `${media.file_unique_id}.bin`,
      public_url: getStoragePublicUrl(`${media.file_unique_id}.bin`),
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
    
    const fileInfoResponse = await fetch(getTelegramApiUrl(`getFile?file_id=${message.file_id}`));
    
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
    const extension = fileData.type.split('/')[1] || 'bin';
    const fileName = `${message.file_unique_id}.${extension}`;

    const { success, publicUrl } = await xdelo_uploadMediaToStorage(fileData, fileName);

    if (!success || !publicUrl) {
      throw new Error('Failed to upload media to storage during redownload');
    }

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
