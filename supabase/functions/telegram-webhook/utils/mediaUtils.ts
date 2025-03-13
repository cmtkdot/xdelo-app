
import { logMessageOperation } from './logger.ts';
import { supabaseClient as supabase } from '../../_shared/supabase.ts';
import { 
  xdelo_isViewableMimeType, 
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_validateAndFixStoragePath,
  xdelo_validateAndFixStoragePath as validateStoragePath,
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage
} from '../../_shared/mediaUtils.ts';

// Declare Deno type for Edge Functions
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  }
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

// Maximum attempts to download from Telegram
const MAX_DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 10000; // 10 seconds timeout
const FILE_ID_REGEX = /^[A-Za-z0-9_-]{20,}$/; // Basic file_id format validation

// Helper to add retry logic for Telegram API calls with timeouts
async function fetchWithRetry(url: string, options = {}, maxRetries = MAX_DOWNLOAD_ATTEMPTS): Promise<Response> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
      
      // Add signal to options
      const fetchOptions = {
        ...options,
        signal: controller.signal
      };
      
      try {
        const response = await fetch(url, fetchOptions);
        // Clear timeout as soon as response is received
        clearTimeout(timeoutId);
        
        if (response.ok) {
          return response;
        }
        
        // If we get a 429 (rate limit), wait longer before retrying
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }
        
        // For Telegram-specific errors, check if it's a temporary issue
        const text = await response.text();
        if (text.includes('temporarily unavailable')) {
          console.log(`Temporary error from Telegram on attempt ${attempt}, retrying...`);
          await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
          continue;
        }
        
        // Check for file_id specific errors
        if (text.includes('wrong file_id')) {
          throw new Error(`Invalid file_id: ${text}`);
        }
        
        lastError = new Error(`HTTP error ${response.status}: ${text}`);
        throw lastError;
      } catch (abortError) {
        // Clear timeout to prevent memory leaks
        clearTimeout(timeoutId);
        
        // Check if this was a timeout
        if (abortError.name === 'AbortError') {
          console.log(`Request timed out on attempt ${attempt}, retrying...`);
          // Only retry timeouts for getFile, not for actual file download
          if (url.includes('getFile') && attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
          throw new Error(`Request timed out after ${DOWNLOAD_TIMEOUT_MS}ms`);
        }
        
        throw abortError;
      }
    } catch (error) {
      lastError = error;
      
      // Only retry network errors or temporary Telegram errors
      if (error.message.includes('network') || 
          error.message.includes('temporarily unavailable')) {
        console.log(`Network or temporary error on attempt ${attempt}, retrying: ${error.message}`);
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

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
    
    // Basic file_id format validation
    if (!FILE_ID_REGEX.test(message.file_id)) {
      console.log(`Warning: file_id format looks suspicious in redownload: ${message.file_id}`);
    }
    
    // Use our shared utility to download the media
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
    } catch (updateError) {
      console.error('Failed to update error state:', updateError);
    }
    
    return {
      success: false,
      message: error.message || 'Unknown error during retry download'
    };
  }
};
