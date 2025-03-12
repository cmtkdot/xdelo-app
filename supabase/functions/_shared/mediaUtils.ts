// Shared media utility functions for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { decode as decodeBase64 } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { xdelo_logProcessingEvent } from "./databaseOperations.ts";

// Create the client once
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Validates and fixes a storage path to ensure it's properly formatted
 */
export async function xdelo_validateAndFixStoragePath(
  fileUniqueId: string,
  existingPath: string | null,
  mimeType: string | null,
  correlationId: string
): Promise<{ path: string; fixed: boolean; error?: string }> {
  try {
    // If no existing path, generate a new one
    if (!existingPath) {
      const extension = mimeType ? mimeType.split('/')[1] || 'bin' : 'bin';
      return {
        path: `${fileUniqueId}.${extension}`,
        fixed: true
      };
    }

    // Check if the path is already in the correct format
    const pathParts = existingPath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    
    // If the filename already starts with the fileUniqueId, it's likely correct
    if (fileName.startsWith(fileUniqueId)) {
      return {
        path: existingPath,
        fixed: false
      };
    }
    
    // Generate a fixed path
    const extension = fileName.includes('.') ? fileName.split('.').pop() : 
                     (mimeType ? mimeType.split('/')[1] || 'bin' : 'bin');
    
    const newPath = `${fileUniqueId}.${extension}`;
    
    // Log the path fix
    await xdelo_logProcessingEvent(
      'storage_path_fixed',
      fileUniqueId,
      correlationId,
      {
        old_path: existingPath,
        new_path: newPath,
        mime_type: mimeType
      }
    );
    
    return {
      path: newPath,
      fixed: true
    };
  } catch (error) {
    console.error(`Error validating storage path for ${fileUniqueId}:`, error);
    return {
      path: existingPath || `${fileUniqueId}.bin`,
      fixed: false,
      error: error.message
    };
  }
}

/**
 * Detects the MIME type of a file based on its content and extension
 */
export async function xdelo_detectMimeType(
  fileData: Uint8Array,
  fileName: string,
  declaredMimeType: string | null
): Promise<string> {
  // Helper function to check file signatures
  function checkSignature(bytes: Uint8Array, signature: number[]): boolean {
    return signature.every((byte, i) => byte === -1 || byte === bytes[i]);
  }
  
  // Common file signatures
  const signatures: Record<string, number[]> = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    'image/gif': [0x47, 0x49, 0x46, 0x38],
    'image/webp': [0x52, 0x49, 0x46, 0x46, -1, -1, -1, -1, 0x57, 0x45, 0x42, 0x50],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
    'video/quicktime': [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20],
  };
  
  // Check file signatures
  for (const [mimeType, signature] of Object.entries(signatures)) {
    if (checkSignature(fileData, signature)) {
      return mimeType;
    }
  }
  
  // If no signature match, use extension-based detection
  if (fileName) {
    const extension = fileName.split('.').pop()?.toLowerCase();
    if (extension) {
      const extensionMap: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'zip': 'application/zip',
        'txt': 'text/plain',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript'
      };
      
      if (extensionMap[extension]) {
        return extensionMap[extension];
      }
    }
  }
  
  // If all else fails, use the declared MIME type or default to octet-stream
  return declaredMimeType || 'application/octet-stream';
}

/**
 * Downloads media from Telegram using the bot API
 */
export async function xdelo_downloadMediaFromTelegram(
  fileId: string,
  correlationId: string
): Promise<{ data: Uint8Array; error?: null } | { data?: null; error: string }> {
  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
    }
    
    // Get file path from Telegram
    const getFileUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const getFileResponse = await fetch(getFileUrl);
    
    if (!getFileResponse.ok) {
      const errorData = await getFileResponse.json();
      throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
    }
    
    const fileData = await getFileResponse.json();
    
    if (!fileData.ok || !fileData.result.file_path) {
      throw new Error(`Failed to get file path: ${JSON.stringify(fileData)}`);
    }
    
    // Download the file
    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    
    // Log the download attempt
    await xdelo_logProcessingEvent(
      'telegram_download_started',
      fileId,
      correlationId,
      {
        file_id: fileId,
        file_path: filePath
      }
    );
    
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
    }
    
    // Get file as array buffer
    const arrayBuffer = await downloadResponse.arrayBuffer();
    const fileContent = new Uint8Array(arrayBuffer);
    
    // Log successful download
    await xdelo_logProcessingEvent(
      'telegram_download_completed',
      fileId,
      correlationId,
      {
        file_id: fileId,
        file_size: fileContent.length,
        file_path: filePath
      }
    );
    
    return { data: fileContent };
  } catch (error) {
    console.error(`Error downloading file from Telegram:`, error);
    
    // Log download error
    await xdelo_logProcessingEvent(
      'telegram_download_failed',
      fileId,
      correlationId,
      {
        file_id: fileId,
        error: error.message
      },
      error.message
    );
    
    return { error: error.message };
  }
}

/**
 * Uploads media to Supabase Storage
 */
export async function xdelo_uploadMediaToStorage(
  fileData: Uint8Array,
  storagePath: string,
  mimeType: string,
  fileUniqueId: string,
  correlationId: string
): Promise<{ url: string; error?: null } | { url?: null; error: string }> {
  try {
    // Determine content disposition based on MIME type
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const contentDisposition = (isImage || isVideo) ? 'inline' : 'attachment';
    
    // Log upload attempt
    await xdelo_logProcessingEvent(
      'storage_upload_started',
      fileUniqueId,
      correlationId,
      {
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: fileData.length,
        content_disposition: contentDisposition
      }
    );
    
    // Upload to storage
    const { error: uploadError } = await supabaseClient.storage
      .from('telegram-media')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        cacheControl: 'public, max-age=31536000',
        upsert: true
      });
    
    if (uploadError) {
      throw uploadError;
    }
    
    // Update metadata
    const { error: metadataError } = await supabaseClient.storage
      .from('telegram-media')
      .updateMetadata(storagePath, {
        cacheControl: 'public, max-age=31536000',
        contentType: mimeType,
        contentDisposition: `${contentDisposition}; filename="${fileUniqueId}"`
      });
    
    if (metadataError) {
      console.warn(`Warning: Failed to update metadata: ${metadataError.message}`);
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    // Log successful upload
    await xdelo_logProcessingEvent(
      'storage_upload_completed',
      fileUniqueId,
      correlationId,
      {
        storage_path: storagePath,
        mime_type: mimeType,
        public_url: publicUrl,
        content_disposition: contentDisposition
      }
    );
    
    return { url: publicUrl };
  } catch (error) {
    console.error(`Error uploading to storage:`, error);
    
    // Log upload error
    await xdelo_logProcessingEvent(
      'storage_upload_failed',
      fileUniqueId,
      correlationId,
      {
        storage_path: storagePath,
        mime_type: mimeType,
        error: error.message
      },
      error.message
    );
    
    return { error: error.message };
  }
}

/**
 * Processes a data URL and converts it to a Uint8Array
 */
export function processDataUrl(dataUrl: string): { data: Uint8Array; mimeType: string } {
  // Extract MIME type and base64 data
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URL format');
  }
  
  const mimeType = matches[1];
  const base64Data = matches[2];
  
  // Decode base64 to Uint8Array
  const binaryData = decodeBase64(base64Data);
  
  return {
    data: binaryData,
    mimeType
  };
}

/**
 * Generates a standardized storage path for a file
 */
export function generateStoragePath(fileUniqueId: string, mimeType: string): string {
  const extension = mimeType.split('/')[1] || 'bin';
  return `${fileUniqueId}.${extension}`;
}
