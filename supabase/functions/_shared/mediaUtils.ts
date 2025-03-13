import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Database } from './types.ts';

// Get file info from Telegram using Bot API
export async function xdelo_getFileInfo(fileId: string, botToken: string): Promise<any> {
  const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Telegram API Error:', response.status, response.statusText);
      return null;
    }
    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API Error:', data.error_code, data.description);
      return null;
    }
    return data.result;
  } catch (error) {
    console.error('Error fetching file info:', error);
    return null;
  }
}

// Download file from Telegram
export async function xdelo_downloadFile(filePath: string, botToken: string): Promise<ArrayBuffer | null> {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Download Error:', response.status, response.statusText);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Download error:', error);
    return null;
  }
}

/**
 * Generates a standard filename based on file_unique_id and mime_type
 * @param file_unique_id The unique file ID from Telegram
 * @param mime_type The MIME type of the file
 * @returns A standardized filename
 */
export function xdelo_getStandardFilename(file_unique_id: string, mime_type: string): string {
  const extension = getFileExtension(mime_type);
  return `${file_unique_id}${extension}`;
}

/**
 * Validates and standardizes a storage path
 * 
 * @param file_unique_id The unique file ID from Telegram
 * @param mime_type The MIME type of the file
 * @returns A standardized storage path
 */
export function xdelo_validateAndFixStoragePath(file_unique_id: string, mime_type: string): string {
  const extension = getFileExtension(mime_type);
  return `${file_unique_id}${extension}`;
}

// Helper function to get proper file extensions based on MIME type
function getFileExtension(mime_type: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/octet-stream': '.bin',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/ogg': '.ogg',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'text/html': '.html',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx'
  };

  // Return the extension or a default if not found
  return mimeToExt[mime_type] || '.bin';
}
