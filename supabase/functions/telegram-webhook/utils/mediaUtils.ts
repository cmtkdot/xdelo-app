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
  xdelo_detectMimeType,
  xdelo_constructStoragePath,
  xdelo_uploadMediaToStorage,
  xdelo_checkFileExistsInStorage,
  xdelo_getDefaultMimeType
} from '../../_shared/mediaUtils.ts';
import { xdelo_logMediaRedownload } from '../../_shared/messageLogger.ts';

// Re-export the primary functions with simpler names for the webhook context
export const getMediaInfo = async (message: any) => {
  // This is now just a wrapper around the shared utility
  try {
    const result = await xdelo_getMediaInfoFromTelegram(message);
    return result;
  } catch (error) {
    console.error('Error in getMediaInfo wrapper:', error);
    throw error;
  }
};

// Function to redownload missing files that also updates the message record
export const redownloadMissingFile = async (message: any) => {
  try {
    // Call the shared utility
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
          error_message: null,
          redownload_attempts: (message.redownload_attempts || 0) + 1
        })
        .eq('id', message.id);

      if (updateError) {
        console.error(`Failed to update message after redownload: ${updateError.message}`);
        // Continue anyway, since the file was uploaded successfully
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
      
      // Keep legacy logging for backward compatibility
      await logMessageOperation('error', crypto.randomUUID(), {
        action: 'redownload_failed',
        file_unique_id: message.file_unique_id,
        error: result.error
      });
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

// Also re-export other utilities that might be used directly
export {
  xdelo_detectMimeType as detectMimeType,
  xdelo_constructStoragePath as constructStoragePath,
  xdelo_uploadMediaToStorage as uploadMediaToStorage,
  xdelo_checkFileExistsInStorage as checkFileExistsInStorage,
  xdelo_getDefaultMimeType as getDefaultMimeType
};
