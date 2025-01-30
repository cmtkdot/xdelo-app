import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export interface MediaUploadResult {
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export async function uploadMedia(
  supabase: ReturnType<typeof createClient>,
  buffer: ArrayBuffer,
  metadata: {
    fileUniqueId: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
  }
): Promise<MediaUploadResult> {
  const fileName = `${metadata.fileUniqueId}.${
    metadata.mimeType?.split("/")[1] || "jpg"
  }`;
  const mimeType = metadata.mimeType || "image/jpeg";

  // Check if file already exists
  const { data: existingFile } = await supabase.storage
    .from("telegram-media")
    .list("", {
      search: fileName,
    });

  if (existingFile && existingFile.length > 0) {
    const {
      data: { publicUrl },
    } = await supabase.storage.from("telegram-media").getPublicUrl(fileName);
    return {
      publicUrl,
      fileName,
      mimeType,
      fileSize: metadata.fileSize,
    };
  }

  // Upload new file
  const { error: uploadError } = await supabase.storage
    .from("telegram-media")
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = await supabase.storage.from("telegram-media").getPublicUrl(fileName);

  return {
    publicUrl,
    fileName,
    mimeType,
    fileSize: metadata.fileSize,
  };
}