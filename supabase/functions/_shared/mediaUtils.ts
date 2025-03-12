
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
 */
export function xdelo_validateAndFixStoragePath(fileUniqueId: string, mimeType: string): string {
  if (!fileUniqueId) {
    throw new Error('File unique ID is required');
  }
  
  // Extract extension from mime type
  let extension = 'bin';
  
  if (mimeType) {
    const parts = mimeType.split('/');
    if (parts.length === 2) {
      extension = parts[1];
      
      // Handle special cases
      if (extension === 'jpeg' || extension === 'jpg') {
        extension = 'jpeg';
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
export function xdelo_detectMimeType(fileUniqueId: string, existingMimeType: string | null = null): string {
  if (!fileUniqueId) {
    return 'application/octet-stream';
  }
  
  // If we already have a mime type that's not octet-stream, use it
  if (existingMimeType && existingMimeType !== 'application/octet-stream') {
    return existingMimeType;
  }
  
  // Try to infer from storage path if available
  const extension = fileUniqueId.split('.').pop()?.toLowerCase();
  
  if (extension) {
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'mp4':
        return 'video/mp4';
      case 'mov':
      case 'qt':
        return 'video/quicktime';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'ogg':
        return 'audio/ogg';
      case 'pdf':
        return 'application/pdf';
      case 'doc':
      case 'docx':
        return 'application/msword';
      case 'xls':
      case 'xlsx':
        return 'application/vnd.ms-excel';
      default:
        return 'application/octet-stream';
    }
  }
  
  return existingMimeType || 'application/octet-stream';
}

/**
 * Download media file from Telegram
 */
export async function xdelo_downloadMediaFromTelegram(fileId: string, botToken: string): Promise<{ data: Uint8Array; error?: null } | { data?: null; error: string }> {
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
    
    // Then download the file
    const fileDownloadResponse = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`
    );
    
    if (!fileDownloadResponse.ok) {
      throw new Error(`Failed to download file: ${fileDownloadResponse.statusText} (Status: ${fileDownloadResponse.status})`);
    }
    
    // Convert to bytes
    const fileData = new Uint8Array(await fileDownloadResponse.arrayBuffer());
    console.log(`Successfully downloaded ${fileData.length} bytes`);
    
    return { data: fileData };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    return { error: error.message || 'Unknown error downloading file' };
  }
}

/**
 * Upload media to Supabase Storage
 */
export async function xdelo_uploadMediaToStorage(
  fileData: Uint8Array, 
  storagePath: string, 
  mimeType: string
): Promise<{ url: string; error?: null } | { url?: null; error: string }> {
  try {
    console.log(`Uploading ${fileData.length} bytes to ${storagePath} with type ${mimeType}`);
    
    // Set upload options with proper content type
    const options = {
      cacheControl: '3600',
      contentType: mimeType || 'application/octet-stream',
      upsert: true
    };
    
    // Upload the file
    const { error } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, options);
    
    if (error) {
      throw error;
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    return { url: publicUrl };
  } catch (error) {
    console.error('Error uploading media to storage:', error);
    return { error: error.message || 'Unknown error uploading file' };
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
    'audio/wav'
  ];
  
  return viewableMimeTypes.includes(mimeType);
}

/**
 * Get appropriate upload options based on file type
 */
export function xdelo_getUploadOptions(mimeType: string): { cacheControl: string; contentType: string; upsert: boolean } {
  return {
    cacheControl: '3600',
    contentType: mimeType || 'application/octet-stream',
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
