
import { SupabaseClient } from "@supabase/supabase-js";
import { logMessageOperation } from "./logger.ts";

export interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  storage_path: string;
}

export async function getFileUrl(
  fileId: string, 
  botToken: string, 
  correlationId: string
): Promise<string> {
  await logMessageOperation('info', correlationId, {
    message: '🔍 Getting file URL from Telegram',
    fileId
  });
  
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const data = await response.json();
  
  if (!data.ok) {
    await logMessageOperation('error', correlationId, {
      message: 'Failed to get file path from Telegram',
      fileId,
      error: data
    });
    throw new Error('Failed to get file path from Telegram');
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
  await logMessageOperation('info', correlationId, {
    message: '✅ Got file URL from Telegram',
    fileUrl
  });
  return fileUrl;
}

export async function downloadMedia(
  fileId: string, 
  botToken: string, 
  correlationId: string
): Promise<ArrayBuffer> {
  await logMessageOperation('info', correlationId, {
    message: '📥 Starting media download from Telegram',
    fileId
  });
  
  const fileUrl = await getFileUrl(fileId, botToken, correlationId);
  const response = await fetch(fileUrl);
  
  if (!response.ok) {
    await logMessageOperation('error', correlationId, {
      message: 'Failed to download media from Telegram',
      fileId,
      status: response.status
    });
    throw new Error('Failed to download media from Telegram');
  }

  const buffer = await response.arrayBuffer();
  await logMessageOperation('info', correlationId, {
    message: '✅ Successfully downloaded media from Telegram',
    fileId,
    size: buffer.byteLength
  });
  return buffer;
}

export async function uploadMediaToStorage(
  mediaBuffer: ArrayBuffer,
  storagePath: string,
  mimeType: string,
  supabaseClient: SupabaseClient,
  correlationId: string
): Promise<string> {
  await logMessageOperation('info', correlationId, {
    message: '📤 Starting media upload to storage',
    storagePath,
    mimeType
  });

  try {
    const { error: uploadError } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storagePath, mediaBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (uploadError) {
      await logMessageOperation('error', correlationId, {
        message: 'Failed to upload to storage',
        error: uploadError
      });
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);

    await logMessageOperation('info', correlationId, {
      message: '✅ Successfully uploaded media to storage',
      publicUrl
    });
    return publicUrl;

  } catch (error) {
    await logMessageOperation('error', correlationId, {
      message: '❌ Error in storage upload',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

export function extractMediaInfo(message: any): MediaInfo | null {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  const video = message.video;
  const document = message.document;

  if (!photo && !video && !document) {
    return null;
  }

  const media = photo || video || document;
  const mimeType = video?.mime_type || document?.mime_type || 'image/jpeg';
  const ext = mimeType.split('/')[1] || 'bin';

  return {
    file_id: media.file_id,
    file_unique_id: media.file_unique_id,
    mime_type: mimeType,
    file_size: media.file_size,
    width: media.width,
    height: media.height,
    duration: video?.duration,
    storage_path: `${media.file_unique_id}.${ext}`
  };
}
