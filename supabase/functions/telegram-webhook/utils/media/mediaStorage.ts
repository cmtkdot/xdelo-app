
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_detectMimeType,
  xdelo_checkFileExistsInStorage
} from "./mediaUtils.ts";
import { xdelo_logProcessingEvent } from "../../../_shared/databaseOperations.ts";

// For Deno compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

/**
 * Find an existing file in the database by file_unique_id
 */
export async function xdelo_findExistingFile(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('file_unique_id', fileUniqueId)
      .limit(1);

    if (error) {
      console.error('Error checking for existing file:', error);
      return { exists: false };
    }

    if (data && data.length > 0) {
      return { exists: true, message: data[0] };
    }

    return { exists: false };
  } catch (error) {
    console.error('Unexpected error checking for existing file:', error);
    return { exists: false };
  }
}

/**
 * Process message media from Telegram, handling download and upload
 * with improved error handling and fallback strategies
 */
export async function xdelo_processMessageMedia(
  message: any,
  fileId: string,
  fileUniqueId: string,
  telegramBotToken: string,
  messageId?: string,
  correlationId?: string
): Promise<{ 
  success: boolean; 
  isDuplicate: boolean; 
  fileInfo: any; 
  error?: string;
  file_id_expired?: boolean;
}> {
  try {
    // First check if this is a duplicate file
    const { exists, message: existingMessage } = await xdelo_findExistingFile(
      // Get Supabase client
      createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      ),
      fileUniqueId
    );

    if (exists && existingMessage) {
      console.log(`Found existing file: ${fileUniqueId}`);
      
      // Return existing file info
      return {
        success: true,
        isDuplicate: true,
        fileInfo: {
          storage_path: existingMessage.storage_path,
          mime_type: existingMessage.mime_type,
          file_size: existingMessage.file_size,
          public_url: existingMessage.public_url
        }
      };
    }

    // Detect MIME type
    const detectedMimeType = xdelo_detectMimeType(message);
    
    // Check if file was previously uploaded by checking the storage path
    const expectedStoragePath = `${fileUniqueId}.${detectedMimeType.split('/')[1]}`;
    const fileExistsInStorage = await xdelo_checkFileExistsInStorage(expectedStoragePath);
    
    // If file already exists in storage, reuse it rather than downloading again
    if (fileExistsInStorage) {
      console.log(`File already exists in storage: ${expectedStoragePath}`);
      
      // Construct public URL
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/telegram-media/${expectedStoragePath}`;
      
      // Log this reuse
      if (correlationId) {
        await xdelo_logProcessingEvent(
          "media_storage_reused",
          fileUniqueId,
          correlationId,
          {
            file_id: fileId,
            file_unique_id: fileUniqueId,
            storage_path: expectedStoragePath
          }
        );
      }
      
      return {
        success: true,
        isDuplicate: false,
        fileInfo: {
          storage_path: expectedStoragePath,
          mime_type: detectedMimeType,
          file_size: 0, // Size unknown when reusing
          public_url: publicUrl
        }
      };
    }
    
    // Download from Telegram
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      fileId,
      fileUniqueId,
      detectedMimeType,
      telegramBotToken
    );
    
    // Handle file_id expiration explicitly
    if (!downloadResult.success && downloadResult.file_id_expired) {
      console.warn(`File ID has expired or is invalid for ${fileUniqueId}`);
      
      if (correlationId) {
        await xdelo_logProcessingEvent(
          "file_id_expired",
          fileUniqueId,
          correlationId,
          {
            file_id: fileId,
            file_unique_id: fileUniqueId,
            error: downloadResult.error
          }
        );
      }
      
      return {
        success: false,
        isDuplicate: false,
        fileInfo: null,
        error: downloadResult.error || 'File ID has expired',
        file_id_expired: true
      };
    }
    
    if (!downloadResult.success || !downloadResult.blob) {
      throw new Error(`Failed to download media: ${downloadResult.error || 'Unknown error'}`);
    }
    
    // Upload to Supabase Storage
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath || `${fileUniqueId}.bin`,
      downloadResult.blob,
      downloadResult.mimeType || detectedMimeType,
      messageId
    );
    
    if (!uploadResult.success) {
      throw new Error(`Failed to upload media: ${uploadResult.error || 'Unknown error'}`);
    }
    
    // Log success
    if (correlationId) {
      await xdelo_logProcessingEvent(
        "media_downloaded_and_stored",
        fileUniqueId,
        correlationId,
        {
          file_id: fileId,
          file_unique_id: fileUniqueId,
          storage_path: downloadResult.storagePath,
          mime_type: downloadResult.mimeType || detectedMimeType,
          file_size: downloadResult.blob.size
        }
      );
    }
    
    // Return the file info
    return {
      success: true,
      isDuplicate: false,
      fileInfo: {
        storage_path: downloadResult.storagePath,
        mime_type: downloadResult.mimeType || detectedMimeType,
        file_size: downloadResult.blob.size,
        public_url: uploadResult.publicUrl
      }
    };
  } catch (error) {
    console.error('Error processing message media:', error);
    
    // Log the error
    if (correlationId) {
      await xdelo_logProcessingEvent(
        "media_processing_error",
        fileUniqueId,
        correlationId,
        {
          file_id: fileId,
          file_unique_id: fileUniqueId,
          error: error.message || 'Unknown error processing media'
        },
        error.message || 'Unknown error processing media'
      );
    }
    
    return {
      success: false,
      isDuplicate: false,
      fileInfo: null,
      error: error.message || 'Unknown error processing media'
    };
  }
}

/**
 * Handle expired file IDs by flagging messages for redownload
 */
export async function xdelo_handleExpiredFileId(
  messageId: string,
  fileUniqueId: string,
  correlationId?: string
): Promise<boolean> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
    // Update the message to flag it for redownload
    const { error } = await supabase
      .from('messages')
      .update({
        needs_redownload: true,
        redownload_reason: 'file_id_expired',
        redownload_flagged_at: new Date().toISOString(),
        file_id_expires_at: new Date().toISOString() // Mark as expired now
      })
      .eq('id', messageId);
    
    if (error) {
      console.error(`Failed to flag message for redownload: ${error.message}`);
      return false;
    }
    
    // Log this action
    if (correlationId) {
      await xdelo_logProcessingEvent(
        "message_flagged_for_redownload",
        messageId,
        correlationId,
        {
          file_unique_id: fileUniqueId,
          reason: 'file_id_expired'
        }
      );
    }
    
    return true;
  } catch (error) {
    console.error(`Error handling expired file ID: ${error.message}`);
    return false;
  }
}
