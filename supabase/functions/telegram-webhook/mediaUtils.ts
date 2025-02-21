import { SupabaseClient } from '@supabase/supabase-js';
import { MediaInfo } from './types.ts';

export function extractMediaInfo(message: any): MediaInfo | null {
  if (message.photo) {
    // Get the highest resolution photo
    const photo = message.photo[message.photo.length - 1];
    return {
      file_id: photo.file_id,
      file_unique_id: photo.file_unique_id,
      mime_type: 'image/jpeg',
      file_size: photo.file_size,
      width: photo.width,
      height: photo.height
    };
  }

  if (message.video) {
    return {
      file_id: message.video.file_id,
      file_unique_id: message.video.file_unique_id,
      mime_type: message.video.mime_type || 'video/mp4',
      file_size: message.video.file_size,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration
    };
  }

  if (message.document) {
    return {
      file_id: message.document.file_id,
      file_unique_id: message.document.file_unique_id,
      mime_type: message.document.mime_type || 'application/octet-stream',
      file_size: message.document.file_size
    };
  }

  return null;
}

export async function downloadTelegramFile(fileId: string, botToken: string): Promise<Response> {
  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
  );
  const fileInfo = await fileInfoResponse.json();

  if (!fileInfo.ok) {
    console.error("❌ Failed to get file info:", fileInfo);
    throw new Error(`Failed to get file info: ${JSON.stringify(fileInfo)}`);
  }

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
  return fetch(fileUrl);
}

export async function uploadMedia(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  metadata: {
    fileUniqueId: string;
    mimeType?: string;
    fileSize?: number;
    messageId: string;
  }
): Promise<{
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}> {
  const fileExt = metadata.mimeType?.split("/")[1] || "jpg";
  const fileName = `${metadata.messageId}/${metadata.fileUniqueId}.${fileExt}`;
  const mimeType = metadata.mimeType || "image/jpeg";

  const { error: uploadError } = await supabase.storage
    .from("telegram-media")
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error("❌ Upload error:", uploadError);
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = await supabase.storage
    .from("telegram-media")
    .getPublicUrl(fileName);

  return {
    publicUrl,
    fileName,
    mimeType,
    fileSize: metadata.fileSize,
  };
}

export async function downloadMedia(
  supabase: SupabaseClient,
  mediaInfo: MediaInfo,
  messageId: string
): Promise<string | null> {
  try {
    const mediaResponse = await downloadTelegramFile(
      mediaInfo.file_id, 
      Deno.env.get('TELEGRAM_BOT_TOKEN')!
    );
    
    const buffer = await mediaResponse.arrayBuffer();
    
    const uploadResult = await uploadMedia(supabase, buffer, {
      fileUniqueId: mediaInfo.file_unique_id,
      mimeType: mediaInfo.mime_type,
      fileSize: mediaInfo.file_size,
      messageId
    });

    console.log('✅ Media downloaded and uploaded successfully:', {
      message_id: messageId,
      file_unique_id: mediaInfo.file_unique_id,
      public_url: uploadResult.publicUrl
    });

    return uploadResult.publicUrl;

  } catch (error) {
    console.error('❌ Error downloading media:', {
      message_id: messageId,
      file_unique_id: mediaInfo.file_unique_id,
      error
    });
    throw error;
  }
}
