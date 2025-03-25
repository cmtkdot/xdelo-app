import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { lookup } from "https://deno.land/x/media_types@v3.1.0/mod.ts";
import { corsHeaders } from './cors.ts';
import { xdelo_logProcessingEvent } from './databaseOperations.ts';

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Download media from Telegram
 */
export async function xdelo_downloadMediaFromTelegramOld(
  fileId: string, 
  botToken: string
): Promise<{ success: boolean; buffer?: Uint8Array; error?: string; contentType?: string }> {
  try {
    // First get file path from Telegram
    const fileInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    
    if (!fileInfoResponse.ok) {
      const errorData = await fileInfoResponse.json();
      throw new Error(`Failed to get file info: ${errorData.description || fileInfoResponse.statusText}`);
    }
    
    const fileInfo = await fileInfoResponse.json();
    
    if (!fileInfo.ok || !fileInfo.result.file_path) {
      throw new Error(`Invalid file info response: ${JSON.stringify(fileInfo)}`);
    }
    
    // Download the file
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
    }
    
    // Get buffer and content type
    const buffer = new Uint8Array(await downloadResponse.arrayBuffer());
    const contentType = downloadResponse.headers.get('content-type') || undefined;
    
    return {
      success: true,
      buffer,
      contentType
    };
  } catch (error) {
    console.error('Error downloading media:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload media to Supabase storage
 */
export async function xdelo_uploadMediaToStorage(
  buffer: Uint8Array,
  storagePath: string,
  mimeType: string,
  correlationId?: string
): Promise<{ success: boolean; publicUrl?: string; error?: string; fileSize?: number }> {
  try {
    // Upload the file
    const { data, error } = await supabaseClient
      .storage
      .from('telegram-media')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true
      });
    
    if (error) {
      throw new Error(`Storage upload error: ${error.message}`);
    }
    
    // Get public URL
    const { data: publicUrlData } = supabaseClient
      .storage
      .from('telegram-media')
      .getPublicUrl(storagePath);
    
    // Get file size
    const fileSize = buffer.byteLength;
    
    // Log the upload
    await xdelo_logProcessingEvent(
      "media_upload_success",
      storagePath,
      correlationId || 'system',
      {
        file_size: fileSize,
        mime_type: mimeType,
        public_url: publicUrlData.publicUrl
      }
    );
    
    return {
      success: true,
      publicUrl: publicUrlData.publicUrl,
      fileSize
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    
    // Log the error
    try {
      await xdelo_logProcessingEvent(
        "media_upload_error",
        storagePath,
        correlationId || 'system',
        {
          error: error.message,
          mime_type: mimeType
        },
        error.message
      );
    } catch {} // Ignore logging errors
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if a MIME type is viewable in a browser
 */
export function xdelo_isViewableMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType.startsWith('video/');
}

/**
 * Detect MIME type from file extension
 */
export function xdelo_detectMimeType(message: any): string | undefined {
  // Check document first
  if (message.document && message.document.file_name) {
    return lookup(message.document.file_name) || undefined;
  }
  
  // Then video
  if (message.video && message.video.file_name) {
    return lookup(message.video.file_name) || undefined;
  }
  
  // Finally photo (less reliable)
  if (message.photo) {
    return 'image/jpeg'; // Assume JPEG for photos
  }
  
  return undefined;
}

/**
 * Validate and fix the storage path for a media item
 * Ensures all storage paths follow our standard format
 */
export async function xdelo_validateAndFixStoragePath(
  fileUniqueId: string,
  mimeType: string,
  correlationId?: string
): Promise<{ success: boolean; storagePath: string; error?: string }> {
  try {
    // Call the database function to get standardized path
    const { data, error } = await supabaseClient.rpc<string>(
      'xdelo_standardize_storage_path',
      {
        p_file_unique_id: fileUniqueId,
        p_mime_type: mimeType
      }
    );
    
    if (error) {
      return {
        success: false,
        storagePath: `${fileUniqueId}.bin`, // Fallback
        error: `Failed to standardize storage path: ${error.message}`
      };
    }
    
    // Log the standardization
    await xdelo_logProcessingEvent(
      "storage_path_standardized",
      fileUniqueId,
      correlationId || 'system',
      {
        original_mime_type: mimeType,
        standardized_path: data
      }
    );
    
    return {
      success: true,
      storagePath: data
    };
  } catch (error) {
    const fallbackPath = `${fileUniqueId}.bin`;
    
    console.error(`Error standardizing storage path: ${error.message}`);
    
    // Log the error
    try {
      await xdelo_logProcessingEvent(
        "storage_path_error",
        fileUniqueId,
        correlationId || 'system',
        {
          error: error.message,
          original_mime_type: mimeType,
          fallback_path: fallbackPath
        },
        error.message
      );
    } catch {} // Ignore logging errors
    
    return {
      success: false,
      storagePath: fallbackPath,
      error: `Exception standardizing storage path: ${error.message}`
    };
  }
}

/**
 * Improved function to download media from Telegram with retries
 */
export async function xdelo_downloadMediaFromTelegram(
  fileId: string, 
  botToken: string,
  correlationId?: string,
  retries: number = 3
): Promise<{ success: boolean; buffer?: Uint8Array; error?: string; contentType?: string }> {
  let lastError: Error | null = null;
  let attempt = 0;
  
  while (attempt < retries) {
    attempt++;
    try {
      // First get file path from Telegram
      const fileInfoResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
      
      if (!fileInfoResponse.ok) {
        const errorData = await fileInfoResponse.json();
        throw new Error(`Failed to get file info: ${errorData.description || fileInfoResponse.statusText}`);
      }
      
      const fileInfo = await fileInfoResponse.json();
      
      if (!fileInfo.ok || !fileInfo.result.file_path) {
        throw new Error(`Invalid file info response: ${JSON.stringify(fileInfo)}`);
      }
      
      // Download the file
      const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.result.file_path}`;
      const downloadResponse = await fetch(downloadUrl);
      
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download file: ${downloadResponse.statusText}`);
      }
      
      // Get buffer and content type
      const buffer = new Uint8Array(await downloadResponse.arrayBuffer());
      const contentType = downloadResponse.headers.get('content-type') || undefined;
      
      // Log the successful download
      try {
        await xdelo_logProcessingEvent(
          "media_download_success",
          fileId,
          correlationId || 'system',
          {
            file_size: buffer.length,
            content_type: contentType,
            attempt
          }
        );
      } catch {} // Ignore logging errors
      
      return {
        success: true,
        buffer,
        contentType
      };
    } catch (error) {
      lastError = error;
      console.error(`Download attempt ${attempt} failed: ${error.message}`);
      
      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 500; // 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }
  
  // Log the failed download
  try {
    await xdelo_logProcessingEvent(
      "media_download_failed",
      fileId,
      correlationId || 'system',
      {
        attempts: attempt,
        error: lastError?.message
      },
      lastError?.message
    );
  } catch {} // Ignore logging errors
  
  return {
    success: false,
    error: `Failed to download media after ${retries} attempts: ${lastError?.message}`
  };
}

/**
 * Standardize a storage path
 */
export async function xdelo_standardizeStoragePath(
  fileUniqueId: string,
  mimeType: string
): Promise<string> {
  // Implementation for standardizing storage path
  return `${fileUniqueId}.bin`;
}
