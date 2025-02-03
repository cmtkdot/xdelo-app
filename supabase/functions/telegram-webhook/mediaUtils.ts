import { TelegramMedia, MediaUploadResult, SupabaseClient } from "./types.ts";

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
  }
): Promise<MediaUploadResult> {
  const fileName = `${metadata.fileUniqueId}.${
    metadata.mimeType?.split("/")[1] || "jpg"
  }`;
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