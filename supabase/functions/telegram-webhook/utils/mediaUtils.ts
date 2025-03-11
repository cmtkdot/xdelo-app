
/**
 * Media Utilities for Telegram Webhook
 * 
 * This file re-exports utilities from the centralized _shared/mediaUtils.ts
 * and provides wrapper functions tailored for the telegram-webhook function.
 */

import { supabaseClient as supabase } from '../../_shared/supabase.ts';
import { logMessageOperation } from './logger.ts';
import { 
  xdelo_getMediaInfoFromTelegram,
  xdelo_redownloadMissingFile,
  xdelo_getExtensionFromMedia,
  xdelo_constructStoragePath,
  xdelo_uploadMediaToStorage,
  xdelo_checkFileExistsInStorage,
  xdelo_getFileExtension,
  xdelo_getUploadOptions
} from '../../_shared/mediaUtils.ts';
import { xdelo_logMediaRedownload } from '../../_shared/messageLogger.ts';

// Re-export the primary functions with simpler names for the webhook context
export const getMediaInfo = async (message: any) => {
  try {
    const correlationId = crypto.randomUUID();
    console.log(`Getting media info for message ${message.message_id} with correlation ID ${correlationId}`);
    
    return await xdelo_getMediaInfoFromTelegram(message, correlationId);
  } catch (error) {
    console.error('Error in getMediaInfo wrapper:', error);
    throw error;
  }
};

// Function to redownload missing files that also updates the message record
export const redownloadMissingFile = async (message: any) => {
  try {
    const result = await xdelo_redownloadMissingFile(message);
    
    if (result.success) {
      // Update the message record
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          needs_redownload: false,
          redownload_completed_at: new Date().toISOString(),
          storage_path: result.storage_path,
          public_url: result.public_url,
          mime_type: result.mime_type,
          error_message: null,
          redownload_attempts: (message.redownload_attempts || 0) + 1
        })
        .eq('id', message.id);

      if (updateError) {
        console.error(`Failed to update message after redownload: ${updateError.message}`);
      }

      // Log success using the new logging function
      await xdelo_logMediaRedownload(
        message.id,
        message.telegram_message_id,
        message.chat_id,
        message.correlation_id || crypto.randomUUID(),
        true,
        {
          file_unique_id: message.file_unique_id,
          storage_path: result.storage_path
        }
      );
      
      // Keep legacy logging for backward compatibility
      await logMessageOperation('success', crypto.randomUUID(), {
        action: 'redownload_completed',
        file_unique_id: message.file_unique_id,
        storage_path: result.storage_path
      });
    } else {
      // Update the message with failure info
      try {
        await supabase
          .from('messages')
          .update({
            redownload_attempts: (message.redownload_attempts || 0) + 1,
            error_message: `Redownload failed: ${result.error}`,
            last_error_at: new Date().toISOString()
          })
          .eq('id', message.id);
      } catch (updateErr) {
        console.error('Error updating error state:', updateErr);
      }
      
      // Log failure using the new logging function
      await xdelo_logMediaRedownload(
        message.id,
        message.telegram_message_id,
        message.chat_id,
        message.correlation_id || crypto.randomUUID(),
        false,
        {
          file_unique_id: message.file_unique_id,
          error: result.error
        }
      );
    }
    
    return result;
  } catch (error) {
    console.error('Error in redownloadMissingFile wrapper:', error);
    return {
      success: false,
      message_id: message.id,
      error: error.message
    };
  }
};

// Get MIME type from extension using the shared utility
export const getMimeTypeFromExtension = (extension: string) => {
  const options = xdelo_getUploadOptions(extension);
  return options.contentType;
};

// Helper function to validate and sanitize extensions
export const getSafeExtension = (extension?: string, mediaType?: string) => {
  if (!extension || extension === 'bin') {
    return mediaType ? xdelo_getFileExtension(mediaType) : 'bin';
  }
  
  // Only allow valid extensions (alphanumeric, 1-5 chars)
  if (/^[a-z0-9]{1,5}$/i.test(extension)) {
    return extension.toLowerCase();
  }
  
  return mediaType ? xdelo_getFileExtension(mediaType) : 'bin';
};

// Also re-export other utilities that might be used directly
export {
  xdelo_getExtensionFromMedia as getExtensionFromMedia,
  xdelo_constructStoragePath as constructStoragePath,
  xdelo_uploadMediaToStorage as uploadMediaToStorage,
  xdelo_checkFileExistsInStorage as checkFileExistsInStorage,
  xdelo_getFileExtension as getFileExtension,
  xdelo_getUploadOptions as getUploadOptions
};
