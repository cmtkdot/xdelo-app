
import { supabase } from "./supabase.ts";

/**
 * Checks if a MIME type should be displayed inline in the browser
 */
export function isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  
  // Common inline viewable types
  const viewableTypes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    
    // PDFs - modern browsers can display these inline
    'application/pdf'
  ];
  
  return viewableTypes.includes(mimeType) || 
         mimeType.startsWith('image/') || 
         mimeType.startsWith('video/');
}

/**
 * Generate a standardized storage path for a file
 */
export function generateStoragePath(fileUniqueId: string, mimeType: string): string {
  // Determine file extension from MIME type
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'application/zip': 'zip'
  };
  
  // Get extension or use bin for unknown types
  const extension = extensions[mimeType] || 'bin';
  
  // Use YYYY/MM folder structure
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  // Return path: YYYY/MM/fileUniqueId.extension
  return `${year}/${month}/${fileUniqueId}.${extension}`;
}

/**
 * Download media from Telegram
 */
export async function downloadMediaFromTelegram(
  fileId: string,
  fileUniqueId: string,
  mimeType: string,
  telegramBotToken: string
): Promise<{
  success: boolean;
  blob?: Blob;
  mimeType?: string;
  storagePath?: string;
  error?: string;
}> {
  try {
    // 1. Get file info from Telegram
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/getFile?file_id=${fileId}`
    );
    
    if (!fileInfoResponse.ok) {
      const errorData = await fileInfoResponse.json();
      throw new Error(`Telegram API error: ${errorData.description || 'Unknown error'}`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) {
      throw new Error('Invalid file info response from Telegram');
    }
    
    // 2. Download the file
    const filePath = fileInfo.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${filePath}`;
    
    const fileResponse = await fetch(downloadUrl);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }
    
    // 3. Get the blob
    const blob = await fileResponse.blob();
    
    // 4. Determine MIME type and storage path
    let detectedMimeType = mimeType;
    if (!detectedMimeType || detectedMimeType === 'application/octet-stream') {
      // Try to determine from file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      if (extension) {
        const mimeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mov': 'video/quicktime',
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
          'zip': 'application/zip'
        };
        detectedMimeType = mimeMap[extension] || mimeType;
      }
    }
    
    // Generate storage path
    const storagePath = generateStoragePath(fileUniqueId, detectedMimeType);
    
    return {
      success: true,
      blob,
      mimeType: detectedMimeType,
      storagePath
    };
  } catch (error) {
    console.error('Error downloading file from Telegram:', error);
    return {
      success: false,
      error: error.message || 'Unknown error downloading file'
    };
  }
}

/**
 * Upload media to Supabase Storage
 */
export async function uploadMediaToStorage(
  storagePath: string,
  blob: Blob,
  mimeType: string,
  messageId?: string
): Promise<{
  success: boolean;
  publicUrl?: string;
  error?: string;
}> {
  try {
    // Determine content disposition based on MIME type
    const contentDisposition = isViewableMimeType(mimeType) ? 'inline' : 'attachment';
    
    // Upload file to storage
    const { data, error } = await supabase.storage
      .from('telegram-media')
      .upload(storagePath, blob, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
        contentDisposition: contentDisposition
      });
    
    if (error) {
      throw new Error(`Storage upload error: ${error.message}`);
    }
    
    // Get public URL
    const { data: urlData } = await supabase.storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
      
    const publicUrl = urlData?.publicUrl;
    
    // If messageId is provided, update the message record
    if (messageId) {
      await supabase
        .from('messages')
        .update({
          storage_path: storagePath,
          public_url: publicUrl,
          storage_exists: true,
          storage_path_standardized: true,
          mime_type: mimeType,
          mime_type_verified: true,
          content_disposition: contentDisposition,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    }
    
    return {
      success: true,
      publicUrl
    };
  } catch (error) {
    console.error('Error uploading to storage:', error);
    return {
      success: false,
      error: error.message || 'Unknown error uploading to storage'
    };
  }
}
