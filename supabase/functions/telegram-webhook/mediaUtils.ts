import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

export type MediaType = "photo" | "video" | "document" | "unknown";

export interface MediaUploadResult {
  publicUrl: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
}

export interface MediaFileMetadata {
  fileUniqueId: string;
  fileType: MediaType;
  mimeType?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
}

export function determineMediaType(mimeType?: string): MediaType {
  if (!mimeType) return "unknown";

  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("application/")) return "document";

  return "unknown";
}

export function generateSafeFileName(metadata: MediaFileMetadata): string {
  const safeId = metadata.fileUniqueId
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_");

  const extension = getFileExtension(metadata);
  return `${safeId}.${extension}`;
}

function getFileExtension(metadata: MediaFileMetadata): string {
  // If we have a MIME type, use it to determine the extension
  if (metadata.mimeType) {
    // Handle specific MIME types
    switch (metadata.mimeType) {
      case "image/jpeg":
      case "image/jpg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/gif":
        return "gif";
      case "image/webp":
        return "webp";
      case "video/mp4":
        return "mp4";
      case "video/webm":
        return "webm";
      default:
        // For other MIME types, get extension from MIME type
        const ext = metadata.mimeType.split("/")[1];
        if (ext && !ext.includes(";")) return ext;
    }
  }

  // Fallback based on file type if no valid extension from MIME type
  switch (metadata.fileType) {
    case "photo":
      return "jpg"; // Default to jpg for photos
    case "video":
      return "mp4";
    case "document":
      return "pdf";
    default:
      return "jpg"; // Default to jpg instead of bin for unknown types that might be images
  }
}

export function getMimeType(metadata: MediaFileMetadata): string {
  if (metadata.mimeType) return metadata.mimeType;

  // If no MIME type provided, infer from file type
  switch (metadata.fileType) {
    case "photo":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "document":
      return "application/pdf";
    default:
      return "image/jpeg"; // Default to JPEG for unknown types that might be images
  }
}

export async function checkFileExists(
  supabase: SupabaseClient,
  fileName: string
): Promise<string | null> {
  try {
    // First try exact match
    const { data: exactMatch } = await supabase.storage
      .from("telegram-media")
      .list("", {
        search: fileName,
        limit: 1,
      });

    if (exactMatch && exactMatch.length > 0) {
      const {
        data: { publicUrl },
      } = await supabase.storage.from("telegram-media").getPublicUrl(fileName);
      return publicUrl;
    }

    // If no exact match, try finding by file_unique_id without extension
    const baseFileName = fileName.split(".")[0];
    const { data: files } = await supabase.storage
      .from("telegram-media")
      .list("", {
        search: baseFileName,
      });

    if (files && files.length > 0) {
      // Find first matching file with same base name
      const matchingFile = files.find((f) =>
        f.name.startsWith(baseFileName + ".")
      );
      if (matchingFile) {
        const {
          data: { publicUrl },
        } = await supabase.storage
          .from("telegram-media")
          .getPublicUrl(matchingFile.name);
        return publicUrl;
      }
    }

    return null;
  } catch (error) {
    console.error("Error checking file existence:", error);
    return null;
  }
}

export async function uploadMedia(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  metadata: MediaFileMetadata
): Promise<MediaUploadResult> {
  const fileName = generateSafeFileName(metadata);
  const mimeType = getMimeType(metadata);

  // Check if file already exists
  const existingUrl = await checkFileExists(supabase, fileName);
  if (existingUrl) {
    return {
      publicUrl: existingUrl,
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
