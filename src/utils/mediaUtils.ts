import { SupabaseClient } from "@supabase/supabase-js";

export type MediaType = 'photo' | 'video' | 'document' | 'unknown';

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
  if (!mimeType) return 'unknown';
  
  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('application/')) return 'document';
  
  return 'unknown';
}

export function generateSafeFileName(metadata: MediaFileMetadata): string {
  const safeId = metadata.fileUniqueId
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_');
    
  const extension = getFileExtension(metadata);
  return `${safeId}.${extension}`;
}

function getFileExtension(metadata: MediaFileMetadata): string {
  if (metadata.mimeType) {
    const ext = metadata.mimeType.split('/')[1];
    if (ext) return ext;
  }
  
  switch (metadata.fileType) {
    case 'photo':
      return 'jpg';
    case 'video':
      return 'mp4';
    case 'document':
      return 'pdf';
    default:
      return 'bin';
  }
}

export function getMimeType(metadata: MediaFileMetadata): string {
  if (metadata.mimeType) return metadata.mimeType;
  
  switch (metadata.fileType) {
    case 'photo':
      return 'image/jpeg';
    case 'video':
      return 'video/mp4';
    case 'document':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export async function checkFileExists(
  supabase: SupabaseClient,
  fileName: string
): Promise<string | null> {
  try {
    const { data: existingFile } = await supabase.storage
      .from('telegram-media')
      .list('', {
        search: fileName,
      });

    if (existingFile && existingFile.length > 0) {
      const { data: { publicUrl } } = await supabase.storage
        .from('telegram-media')
        .getPublicUrl(fileName);
      return publicUrl;
    }

    return null;
  } catch (error) {
    console.error('Error checking file existence:', error);
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
      fileSize: metadata.fileSize
    };
  }

  // Upload new file
  const { error: uploadError } = await supabase.storage
    .from('telegram-media')
    .upload(fileName, buffer, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw uploadError;
  }

  const { data: { publicUrl } } = await supabase.storage
    .from('telegram-media')
    .getPublicUrl(fileName);

  return {
    publicUrl,
    fileName,
    mimeType,
    fileSize: metadata.fileSize
  };
}