
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { corsHeaders } from "./cors.ts";

// Create the client once
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Map standard extension for common mime types
const mimeToExtensionMap: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/x-tgsticker': 'tgs',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z'
};

/**
 * Get standard file extension from MIME type
 */
export function xdelo_getExtensionFromMimeType(mimeType: string): string {
  // Check our mapping first
  if (mimeType && mimeToExtensionMap[mimeType]) {
    return mimeToExtensionMap[mimeType];
  }
  
  // If not in our map, try to extract from MIME type
  if (mimeType && mimeType.includes('/')) {
    // Get part after slash and remove any parameters
    const subtype = mimeType.split('/')[1].split(';')[0];
    
    // Handle special cases that need standardization
    if (subtype === 'jpeg') return 'jpg';
    if (subtype === 'mpeg') return 'mp3';
    if (subtype === 'quicktime') return 'mov';
    
    // For extremely long subtypes, use a reasonable extension
    if (subtype.length > 10) {
      // Handle Office formats
      if (subtype.includes('openxmlformats')) {
        if (subtype.includes('wordprocessing')) return 'docx';
        if (subtype.includes('spreadsheet')) return 'xlsx';
        if (subtype.includes('presentation')) return 'pptx';
      }
      return 'bin';
    }
    
    return subtype;
  }
  
  // Fallback to binary for unknown types
  return 'bin';
}

/**
 * Standardize and fix a storage path based on file_unique_id and mime_type
 * Preserves original extension when possible
 */
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string, originalFilename?: string): string {
  if (!fileUniqueId) {
    throw new Error('File unique ID is required');
  }
  
  // Try to get extension from original filename first
  let extension = 'bin';
  
  if (originalFilename) {
    const filenameParts = originalFilename.split('.');
    if (filenameParts.length > 1) {
      extension = filenameParts.pop()?.toLowerCase() || 'bin';
      
      // Standardize on common extensions
      if (extension === 'jpeg') extension = 'jpg';
      if (extension === 'mpeg') extension = 'mp3';
      if (extension === 'quicktime') extension = 'mov';
    }
  }
  
  // If no extension from filename, extract from mime type
  if (extension === 'bin' && mimeType) {
    extension = xdelo_getExtensionFromMimeType(mimeType);
  }
  
  return `${fileUniqueId}.${extension}`;
}

/**
 * Detect correct MIME type from file content or extension
 */
export function xdelo_detectMimeType(fileUniqueId: string, existingMimeType: string | null = null, originalFilename?: string): string {
  if (!fileUniqueId) {
    return 'application/octet-stream';
  }
  
  // If we already have a mime type that's not octet-stream, use it
  if (existingMimeType && existingMimeType !== 'application/octet-stream') {
    return existingMimeType;
  }
  
  // Try to infer from original filename first if available
  if (originalFilename) {
    const extension = originalFilename.split('.').pop()?.toLowerCase();
    if (extension) {
      const mimeType = getMimeTypeFromExtension(extension);
      if (mimeType) return mimeType;
    }
  }
  
  // Try to infer from file unique ID if it has an extension
  const extension = fileUniqueId.split('.').pop()?.toLowerCase();
  
  if (extension && extension !== fileUniqueId.toLowerCase()) {
    const mimeType = getMimeTypeFromExtension(extension);
    if (mimeType) return mimeType;
  }
  
  return existingMimeType || 'application/octet-stream';
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(extension: string): string | null {
  // Inverse of our extension map
  const extToMimeMap: Record<string, string> = {};
  
  // Build inverse map
  Object.entries(mimeToExtensionMap).forEach(([mime, ext]) => {
    extToMimeMap[ext] = mime;
  });
  
  // Special cases for common extensions
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'mov' || extension === 'qt') return 'video/quicktime';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'pdf') return 'application/pdf';
  
  // Check our inverse map
  return extToMimeMap[extension] || null;
}

/**
 * Download media file from Telegram with improved metadata handling
 */
export async function xdelo_downloadMediaFromTelegram(
  fileId: string, 
  fileUniqueId: string,
  mimeType: string,
  botToken: string
): Promise<{ 
  success: boolean; 
  blob?: Blob; 
  storagePath?: string; 
  error?: string; 
  mimeType?: string;
  originalFilename?: string;
  fileMetadata?: any;
}> {
  try {
    console.log(`Getting file path for file ID: ${fileId}`);
    
    // First get the file path
    const fileInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    
    if (!fileInfoResponse.ok) {
      const errorText = await fileInfoResponse.text();
      throw new Error(`Failed to get file info: ${errorText} (Status: ${fileInfoResponse.status})`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result?.file_path) {
      throw new Error(`Invalid file info response: ${JSON.stringify(fileInfo)}`);
    }
    
    const filePath = fileInfo.result.file_path;
    console.log(`Got file path: ${filePath}`);
    
    // Extract original filename from path if available
    const originalFilename = filePath.split('/').pop();
    
    // Then download the file
    const fileDownloadResponse = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`
    );
    
    if (!fileDownloadResponse.ok) {
      throw new Error(`Failed to download file: ${fileDownloadResponse.statusText} (Status: ${fileDownloadResponse.status})`);
    }
    
    // Get content type from response headers
    const contentType = fileDownloadResponse.headers.get('content-type');
    const detectedMimeType = contentType && contentType !== 'application/octet-stream' 
      ? contentType 
      : mimeType;
      
    // Create a blob with the correct mime type
    const fileData = await fileDownloadResponse.blob();
    const fileBlob = new Blob([fileData], { type: detectedMimeType });
    
    // Generate storage path using original filename when possible
    const storagePath = xdelo_validateAndFixStoragePath(fileUniqueId, detectedMimeType, originalFilename);
    
    console.log(`Successfully downloaded ${fileBlob.size} bytes with type ${detectedMimeType}, path: ${storagePath}, original filename: ${originalFilename || 'unknown'}`);
    
    return { 
      success: true, 
      blob: fileBlob, 
      storagePath,
      mimeType: detectedMimeType,
      originalFilename,
      fileMetadata: {
        originalPath: filePath,
        size: fileBlob.size,
        telegramInfo: fileInfo.result
      }
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error downloading file' 
    };
  }
}

/**
 * Upload media to Supabase Storage with proper metadata
 */
export async function xdelo_uploadMediaToStorage(
  storagePath: string,
  fileBlob: Blob,
  mimeType: string,
  messageId?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    console.log(`Uploading ${fileBlob.size} bytes to ${storagePath} with type ${mimeType}`);
    
    // Get Supabase URL for consistent URL generation
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'SUPABASE_URL')
      .single();
    
    const supabaseUrl = appSettings?.value || Deno.env.get('SUPABASE_URL') || '';
    
    // Determine if file should be viewable in browser
    const isViewable = xdelo_isViewableMimeType(mimeType);
    
    // Set upload options with proper content type and disposition
    const options = {
      cacheControl: '3600',
      contentType: mimeType || 'application/octet-stream',
      contentDisposition: isViewable ? 'inline' : 'attachment',
      upsert: true
    };
    
    // Upload the file
    const { error } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storagePath, fileBlob, options);
    
    if (error) {
      throw error;
    }
    
    // Build the public URL with the consistent pattern
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${storagePath}`;
    
    // If messageId is provided, update the message record with the public URL
    if (messageId) {
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          public_url: publicUrl,
          storage_exists: true,
          storage_path_standardized: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
      if (updateError) {
        console.warn(`Warning: Failed to update message ${messageId} with public URL: ${updateError.message}`);
      }
    }
    
    return { success: true, publicUrl };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error uploading file' 
    };
  }
}

/**
 * Check if a MIME type is viewable in browsers
 */
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  
  const viewableMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'application/pdf'
  ];
  
  return viewableMimeTypes.includes(mimeType);
}

/**
 * Get appropriate upload options based on file type
 */
export function xdelo_getUploadOptions(mimeType: string): { 
  cacheControl: string; 
  contentType: string; 
  contentDisposition: string;
  upsert: boolean 
} {
  const isViewable = xdelo_isViewableMimeType(mimeType);
  
  return {
    cacheControl: '3600',
    contentType: mimeType || 'application/octet-stream',
    contentDisposition: isViewable ? 'inline' : 'attachment',
    upsert: true
  };
}

/**
 * Repair content disposition metadata for a file
 */
export async function xdelo_repairContentDisposition(
  storagePath: string
): Promise<boolean> {
  try {
    console.log(`Repairing content disposition for ${storagePath}`);
    
    // Get current metadata
    const { data: metadata, error: metadataError } = await supabaseClient
      .storage
      .from('telegram-media')
      .getMetadata(storagePath);
    
    if (metadataError) {
      throw new Error(`Metadata fetch failed: ${metadataError.message}`);
    }
    
    // No need to update if already set correctly
    if (metadata?.cacheControl === '3600' && 
        metadata?.contentType && 
        metadata?.contentDisposition === 'inline') {
      return true;
    }
    
    // Determine best content type based on extension
    const extension = storagePath.split('.').pop()?.toLowerCase();
    let contentType = metadata?.contentType || 'application/octet-stream';
    
    if (extension) {
      const mimeType = getMimeTypeFromExtension(extension);
      if (mimeType) contentType = mimeType;
    }
    
    // Check if it should be viewable in-browser
    const isViewable = xdelo_isViewableMimeType(contentType);
    
    // Update the storage metadata
    await supabaseClient
      .storage
      .from('telegram-media')
      .updateMetadata(storagePath, {
        cacheControl: '3600',
        contentType: contentType,
        contentDisposition: isViewable ? 'inline' : 'attachment'
      });
    
    return true;
  } catch (error) {
    console.error('Error repairing content disposition:', error);
    return false;
  }
}

/**
 * Recover and update file metadata
 */
export async function xdelo_recoverFileMetadata(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current message data
    const { data: message, error: messageError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (messageError) {
      throw new Error(`Message fetch failed: ${messageError.message}`);
    }
    
    if (!message.storage_path) {
      throw new Error('Message has no storage path');
    }
    
    // Get current storage metadata
    const { data: metadata, error: metadataError } = await supabaseClient
      .storage
      .from('telegram-media')
      .getMetadata(message.storage_path);
    
    if (metadataError) {
      throw new Error(`Metadata fetch failed: ${metadataError.message}`);
    }
    
    // Extract file extension from storage path
    const fileExtension = message.storage_path.split('.').pop()?.toLowerCase();
    
    // Infer correct MIME type
    let correctMimeType = message.mime_type;
    if (!correctMimeType || correctMimeType === 'application/octet-stream') {
      correctMimeType = xdelo_detectMimeType(message.storage_path, message.mime_type);
    }
    
    // Generate correct public URL
    const { data: appSettings } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'SUPABASE_URL')
      .single();
    
    const supabaseUrl = appSettings?.value || Deno.env.get('SUPABASE_URL') || '';
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${message.storage_path}`;
    
    // Update the database record
    const { error: dbError } = await supabaseClient
      .from('messages')
      .update({
        mime_type_verified: true,
        mime_type: correctMimeType,
        storage_metadata: metadata,
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (dbError) {
      throw new Error(`Database update failed: ${dbError.message}`);
    }
    
    // Check if content should be viewable in-browser
    const isViewable = xdelo_isViewableMimeType(correctMimeType);
    
    // Update the storage metadata
    await supabaseClient
      .storage
      .from('telegram-media')
      .updateMetadata(message.storage_path, {
        cacheControl: '3600',
        contentType: correctMimeType,
        contentDisposition: isViewable ? 'inline' : 'attachment'
      });
    
    // Log success
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'file_metadata_recovered',
        entity_id: messageId,
        metadata: {
          storage_path: message.storage_path,
          mime_type: correctMimeType,
          operation: 'recover_file_metadata'
        },
        correlation_id: crypto.randomUUID(),
        event_timestamp: new Date().toISOString()
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error recovering file metadata:', error);
    return { success: false, error: error.message };
  }
}
