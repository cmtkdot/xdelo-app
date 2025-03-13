
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";
import { corsHeaders } from "./cors.ts";

// Create the client once
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
    }
  }
  
  // If no extension from filename, extract from mime type
  if (extension === 'bin' && mimeType) {
    const parts = mimeType.split('/');
    if (parts.length === 2) {
      extension = parts[1].split(';')[0]; // Remove parameters like charset
      
      // Handle special cases
      if (extension === 'jpeg' || extension === 'jpg') {
        extension = 'jpg'; // Standardize on jpg
      } else if (extension === 'quicktime') {
        extension = 'mov';
      }
    }
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
  
  // Try to infer from storage path if available
  const extension = fileUniqueId.split('.').pop()?.toLowerCase();
  
  if (extension) {
    const mimeType = getMimeTypeFromExtension(extension);
    if (mimeType) return mimeType;
  }
  
  return existingMimeType || 'application/octet-stream';
}

/**
 * Get MIME type from file extension
 */
function getMimeTypeFromExtension(extension: string): string | null {
  const mimeTypeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'qt': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'tgs': 'application/x-tgsticker'
  };
  
  return extension in mimeTypeMap ? mimeTypeMap[extension] : null;
}

/**
 * Download media file from Telegram
 * Preserves original file metadata
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
    
    // Convert to blob with proper mime type
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
      originalFilename
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
    
    // Get the public URL using Supabase's built-in functionality
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    // If messageId is provided, update the message record with the public URL
    if (messageId) {
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          public_url: publicUrl,
          storage_exists: true,
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
  messageId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Repairing content disposition for ${storagePath}`);
    
    // Update the database record
    const { error: dbError } = await supabaseClient
      .from('messages')
      .update({
        content_disposition: 'inline',
        mime_type_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (dbError) {
      throw new Error(`Database update failed: ${dbError.message}`);
    }
    
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
      return { success: true };
    }
    
    // Update the storage metadata
    await supabaseClient
      .storage
      .from('telegram-media')
      .updateMetadata(storagePath, {
        cacheControl: '3600',
        contentType: metadata?.contentType || 'application/octet-stream',
        contentDisposition: 'inline'
      });
    
    // Log success
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'file_metadata_fixed',
        entity_id: messageId,
        metadata: {
          storage_path: storagePath,
          content_disposition: 'inline',
          operation: 'repair_content_disposition'
        },
        correlation_id: crypto.randomUUID(),
        event_timestamp: new Date().toISOString()
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error repairing content disposition:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recover and update file metadata
 */
export async function xdelo_recoverFileMetadata(
  messageId: string,
  storagePath: string
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
    
    // Get current storage metadata
    const { data: metadata, error: metadataError } = await supabaseClient
      .storage
      .from('telegram-media')
      .getMetadata(storagePath);
    
    if (metadataError) {
      throw new Error(`Metadata fetch failed: ${metadataError.message}`);
    }
    
    // Extract file extension from storage path
    const fileExtension = storagePath.split('.').pop()?.toLowerCase();
    
    // Infer correct MIME type
    let correctMimeType = message.mime_type;
    if (!correctMimeType || correctMimeType === 'application/octet-stream') {
      correctMimeType = xdelo_detectMimeType(storagePath, message.mime_type);
    }
    
    // Update the database record
    const { error: dbError } = await supabaseClient
      .from('messages')
      .update({
        mime_type_verified: true,
        mime_type: correctMimeType,
        storage_metadata: metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    if (dbError) {
      throw new Error(`Database update failed: ${dbError.message}`);
    }
    
    // Update the storage metadata
    await supabaseClient
      .storage
      .from('telegram-media')
      .updateMetadata(storagePath, {
        cacheControl: '3600',
        contentType: correctMimeType,
        contentDisposition: 'inline'
      });
    
    // Log success
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'file_metadata_recovered',
        entity_id: messageId,
        metadata: {
          storage_path: storagePath,
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
