
import { createClient } from '@supabase/supabase-js';
import { FunctionInvocationContext } from './types';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function downloadMedia(fileId: string, botToken: string): Promise<ArrayBuffer> {
  // First get file path from Telegram
  const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  const filePathResponse = await fetch(getFileUrl);
  const filePathData = await filePathResponse.json();

  if (!filePathData.ok || !filePathData.result.file_path) {
    throw new Error(`Failed to get file path: ${JSON.stringify(filePathData)}`);
  }

  // Now download the actual file
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${filePathData.result.file_path}`;
  const fileResponse = await fetch(fileUrl);
  
  if (!fileResponse.ok) {
    throw new Error(`Failed to download file: ${fileResponse.statusText}`);
  }

  return await fileResponse.arrayBuffer();
}

export async function uploadMediaToStorage(
  fileData: ArrayBuffer,
  storagePath: string,
  mimeType: string,
  context: FunctionInvocationContext
): Promise<string> {
  try {
    context.logger.info(`Uploading file to ${storagePath}`);

    const { data, error } = await supabaseAdmin.storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      context.logger.error('Storage upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    context.logger.info(`File uploaded successfully, public URL: ${publicUrlData.publicUrl}`);
    
    return publicUrlData.publicUrl;
  } catch (error) {
    context.logger.error('Error in uploadMediaToStorage:', error);
    throw error;
  }
}

export function getMimeType(message: any): string {
  if (message.photo) return 'image/jpeg';
  if (message.video) return message.video.mime_type || 'video/mp4';
  if (message.document) return message.document.mime_type || 'application/octet-stream';
  return 'application/octet-stream';
}

export function getStoragePath(fileUniqueId: string, mimeType: string): string {
  const extension = mimeType.split('/')[1] || 'bin';
  return `${fileUniqueId}.${extension}`;
}

export async function extractMediaInfo(message: any, context: FunctionInvocationContext) {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  const video = message.video;
  const document = message.document;
  
  const media = photo || video || document;
  if (!media) return null;

  const mimeType = getMimeType(message);
  const storagePath = getStoragePath(media.file_unique_id, mimeType);

  return {
    file_id: media.file_id,
    file_unique_id: media.file_unique_id,
    mime_type: mimeType,
    file_size: media.file_size,
    width: media.width,
    height: media.height,
    duration: video?.duration,
    storage_path: storagePath
  };
}
