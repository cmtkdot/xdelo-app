
import { createSupabaseClient } from "./supabase.ts";
import { xdelo_fetchWithRetry } from "./standardizedHandler.ts";

/**
 * Detects the MIME type from Telegram media objects
 */
export function xdelo_detectMimeType(mediaObj: any): string {
  if (!mediaObj) return 'application/octet-stream';
  
  // Check for explicit mime_type in various media objects
  if (mediaObj.document?.mime_type) return mediaObj.document.mime_type;
  if (mediaObj.video?.mime_type) return mediaObj.video.mime_type;
  if (mediaObj.audio?.mime_type) return mediaObj.audio.mime_type;
  if (mediaObj.voice?.mime_type) return mediaObj.voice.mime_type;
  
  // Photos don't have mime_type in Telegram, use default
  if (mediaObj.photo) return 'image/jpeg';
  
  return 'application/octet-stream';
}

/**
 * Checks if a MIME type is viewable in browsers
 */
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  const viewableMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav',
    'text/plain', 'text/html', 'text/css', 'application/javascript',
    'application/pdf'
  ];
  
  return viewableMimeTypes.includes(mimeType);
}

/**
 * Get upload options for Supabase Storage
 */
export function xdelo_getUploadOptions(mimeType: string): Record<string, string> {
  const options: Record<string, string> = {
    'content-type': mimeType
  };
  
  // Add appropriate content disposition for better download handling
  if (xdelo_isViewableMimeType(mimeType)) {
    options['content-disposition'] = 'inline';
  } else {
    options['content-disposition'] = 'attachment';
  }
  
  return options;
}

/**
 * Repair content disposition metadata for a storage object
 */
export async function xdelo_repairContentDisposition(path: string): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    const bucketName = path.split('/')[0];
    const filePath = path.split('/').slice(1).join('/');
    
    // Get current metadata
    const { data: currentMetadata, error: metadataError } = await supabase
      .storage
      .from(bucketName)
      .getPublicUrl(filePath);
      
    if (metadataError) {
      console.error(`Error getting URL for ${path}:`, metadataError);
      return false;
    }
    
    // Get the file's mime type
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('mime_type')
      .eq('storage_path', filePath)
      .single();
      
    if (messageError) {
      console.error(`Error getting mime type for ${path}:`, messageError);
      return false;
    }
    
    const mimeType = message.mime_type || 'application/octet-stream';
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    
    // We need to download and re-upload to change metadata
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(bucketName)
      .download(filePath);
      
    if (downloadError) {
      console.error(`Error downloading ${path}:`, downloadError);
      return false;
    }
    
    // Re-upload with correct metadata
    const { error: uploadError } = await supabase
      .storage
      .from(bucketName)
      .upload(filePath, fileData, {
        upsert: true,
        contentType: mimeType,
        ...uploadOptions
      });
      
    if (uploadError) {
      console.error(`Error re-uploading ${path}:`, uploadError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Exception in xdelo_repairContentDisposition for ${path}:`, error);
    return false;
  }
}

/**
 * Recover file metadata for a message
 */
export async function xdelo_recoverFileMetadata(messageId: string): Promise<{
  success: boolean;
  error?: string;
  updated?: boolean;
  mime_type?: string;
  file_size?: number;
  storage_path?: string;
}> {
  try {
    const supabase = createSupabaseClient();
    
    // Get message data
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError) {
      return {
        success: false,
        error: `Error fetching message: ${messageError.message}`
      };
    }
    
    if (!message.storage_path) {
      return {
        success: false,
        error: 'Message has no storage path'
      };
    }
    
    // Try to get file metadata
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('telegram-media')
      .download(message.storage_path);
      
    if (downloadError) {
      return {
        success: false,
        error: `Error downloading file: ${downloadError.message}`
      };
    }
    
    // Detect mime type if not already set
    let mimeType = message.mime_type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = xdelo_detectMimeType(message.telegram_data);
    }
    
    // Update message with recovered data
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        mime_type: mimeType,
        file_size: fileData.size,
        has_file: true,
        file_missing: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      return {
        success: false,
        error: `Error updating message: ${updateError.message}`
      };
    }
    
    return {
      success: true,
      updated: true,
      mime_type: mimeType,
      file_size: fileData.size,
      storage_path: message.storage_path
    };
  } catch (error) {
    return {
      success: false,
      error: `Exception in xdelo_recoverFileMetadata: ${error.message}`
    };
  }
}

/**
 * Validate and fix storage path if needed
 */
export async function xdelo_validateAndFixStoragePath(messageId: string): Promise<{
  success: boolean;
  error?: string;
  original_path?: string;
  new_path?: string;
  updated?: boolean;
}> {
  try {
    const supabase = createSupabaseClient();
    
    // Get message data
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError) {
      return {
        success: false,
        error: `Error fetching message: ${messageError.message}`
      };
    }
    
    if (!message.storage_path) {
      return {
        success: false,
        error: 'Message has no storage path'
      };
    }
    
    // Check if storage path follows the standard format
    const standardPattern = /^(\d+)\/(\d+)\/([a-zA-Z0-9_.-]+)$/;
    if (standardPattern.test(message.storage_path)) {
      return {
        success: true,
        original_path: message.storage_path,
        updated: false
      };
    }
    
    // If not standard, create a new standardized path
    const chatId = message.chat_id.toString().replace('-', 'm');
    const messageId = message.telegram_message_id;
    const fileId = message.file_unique_id || crypto.randomUUID().replace(/-/g, '');
    const fileExt = message.storage_path.split('.').pop() || 'bin';
    
    const newPath = `${chatId}/${messageId}/${fileId}.${fileExt}`;
    
    // Copy file to new path
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('telegram-media')
      .download(message.storage_path);
      
    if (downloadError) {
      return {
        success: false,
        error: `Error downloading from old path: ${downloadError.message}`
      };
    }
    
    // Upload to new path
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(newPath, fileData, {
        upsert: true,
        contentType: message.mime_type || 'application/octet-stream'
      });
      
    if (uploadError) {
      return {
        success: false,
        error: `Error uploading to new path: ${uploadError.message}`
      };
    }
    
    // Update message with new path
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        storage_path: newPath,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      return {
        success: false,
        error: `Error updating message: ${updateError.message}`
      };
    }
    
    // Optionally remove old file after successful migration
    const { error: removeError } = await supabase
      .storage
      .from('telegram-media')
      .remove([message.storage_path]);
      
    // Log removal error but don't fail the operation
    if (removeError) {
      console.warn(`Warning: Could not remove old file ${message.storage_path}: ${removeError.message}`);
    }
    
    return {
      success: true,
      original_path: message.storage_path,
      new_path: newPath,
      updated: true
    };
  } catch (error) {
    return {
      success: false,
      error: `Exception in xdelo_validateAndFixStoragePath: ${error.message}`
    };
  }
}
