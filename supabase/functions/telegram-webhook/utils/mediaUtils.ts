import { logMessageOperation } from './logger.ts'
import { supabaseClient as supabase } from '../../_shared/supabase.ts'
import { 
  xdelo_isViewableMimeType,
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_validateAndFixStoragePath,
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_processMessageMedia
} from '../../_shared/mediaUtils.ts';

// Declare Deno type for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  }
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

// Interface for message records in database
interface MessageRecord {
  id: string;
  file_id: string;
  file_unique_id: string;
  media_group_id?: string;
  mime_type?: string;
  redownload_attempts?: number;
  file_size?: number;
}

// Enhanced function to redownload missing files (using our shared utilities)
export const redownloadMissingFile = async (message: MessageRecord): Promise<{success: boolean, message: string, data?: any}> => {
  try {
    console.log('Attempting to redownload file for message:', message.id);
    
    if (!message.file_id || !message.file_unique_id) {
      throw new Error('Missing file_id or file_unique_id for redownload');
    }
    
    // Use our shared utility to download the media with improved retry logic
    const downloadResult = await xdelo_downloadMediaFromTelegram(
      message.file_id,
      message.file_unique_id,
      message.mime_type || 'application/octet-stream',
      TELEGRAM_BOT_TOKEN
    );
    
    if (!downloadResult.success || !downloadResult.blob || !downloadResult.storagePath) {
      throw new Error(downloadResult.error || 'Failed to download media from Telegram');
    }
    
    // Upload to storage using shared utility with message ID for direct update
    const uploadResult = await xdelo_uploadMediaToStorage(
      downloadResult.storagePath,
      downloadResult.blob,
      downloadResult.mimeType || message.mime_type || 'application/octet-stream',
      message.id // Pass message ID for direct update
    );
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Failed to upload media to storage');
    }
    
    // Log the redownload success
    await logMessageOperation(
      'media_redownloaded',
      message.id,
      {
        file_unique_id: message.file_unique_id,
        storage_path: downloadResult.storagePath,
        file_size: downloadResult.blob.size
      }
    );
    
    // Update the message record with minimal fields since public_url is updated by uploadMediaToStorage
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_id: message.file_id,
        storage_path: downloadResult.storagePath,
        mime_type: downloadResult.mimeType || message.mime_type,
        error_message: null,
        error_code: null, 
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        storage_exists: true,
        storage_path_standardized: true,
        file_size: downloadResult.blob.size || message.file_size
      })
      .eq('id', message.id);
      
    if (updateError) {
      throw new Error(`Failed to update message record: ${updateError.message}`);
    }
    
    return {
      success: true,
      message: 'Successfully redownloaded and updated file',
      data: {
        messageId: message.id,
        storagePath: downloadResult.storagePath,
        fileSize: downloadResult.blob.size,
        publicUrl: uploadResult.publicUrl
      }
    };
  } catch (error) {
    console.error('Error in redownloadMissingFile:', error);
    
    try {
      // Update the message with the error
      await supabase
        .from('messages')
        .update({
          error_message: `Retry download failed: ${error.message}`,
          error_code: (error as any).code || 'RETRY_DOWNLOAD_FAILED',
          redownload_attempts: (message.redownload_attempts || 0) + 1,
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);
      
      // Log the error
      await logMessageOperation(
        'error',
        message.id,
        {
          operation: 'redownload',
          error: error.message
        }
      );
    } catch (updateError) {
      console.error('Failed to update error state:', updateError);
    }
    
    return {
      success: false,
      message: error.message || 'Unknown error during retry download'
    };
  }
};

// Stub for xdelo_findExistingFile if it's not available in mediaUtils.ts
export const xdelo_findExistingFile = async (
  supabaseClient: any,
  fileUniqueId: string
): Promise<{ exists: boolean; message?: any }> => {
  // Implementation that would normally be in the shared file
  const { data, error } = await supabaseClient
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
};

// Export all functions from the shared mediaUtils for backward compatibility
export { 
  xdelo_isViewableMimeType,
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_validateAndFixStoragePath,
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_processMessageMedia
};
