import { logMessageOperation } from './logger.ts';
import { supabaseClient as supabase } from '../../_shared/supabase.ts';
import { 
  xdelo_isViewableMimeType, 
  xdelo_getUploadOptions,
  xdelo_detectMimeType,
  xdelo_validateStoragePath,
  xdelo_validateAndFixStoragePath
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

// Define interfaces
interface TelegramMedia {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
}

interface MessageWithMedia {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  photo?: TelegramMedia[];
  video?: TelegramMedia & {
    mime_type?: string;
    duration?: number;
  };
  document?: TelegramMedia & {
    mime_type?: string;
    file_name?: string;
  };
  caption?: string;
  media_group_id?: string;
}

interface MediaInfo {
  file_id: string;
  file_unique_id: string;
  mime_type: string;
  mime_type_original?: string;
  file_size?: number;
  storage_path?: string;
  public_url?: string;
  is_duplicate?: boolean;
  storage_exists?: boolean;
  storage_path_standardized?: boolean;
  needs_redownload?: boolean;
  redownload_reason?: string;
  redownload_flagged_at?: string;
  error_code?: string;
  error_message?: string;
}

export const getMediaInfo = async (message: MessageWithMedia): Promise<MediaInfo> => {
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  const video = message.video;
  const document = message.document;
  
  const media = photo || video || document;
  if (!media) throw new Error('No media found in message');

  // Validate the file_id
  if (!media.file_id || typeof media.file_id !== 'string') {
    throw new Error(`Invalid file_id: ${JSON.stringify(media.file_id)}`);
  }
  
  // Basic file_id format validation
  if (!FILE_ID_REGEX.test(media.file_id)) {
    console.log(`Warning: file_id format looks suspicious: ${media.file_id}`);
    // Continue anyway as Telegram sometimes changes their format
  }

  // Check if file already exists in the database
  const { data: existingFiles } = await supabase
    .from('messages')
    .select('file_unique_id, storage_path, public_url, mime_type, file_size')
    .eq('file_unique_id', media.file_unique_id)
    .eq('deleted_from_telegram', false)
    .limit(1);

  // If we already have this file, return the existing information
  if (existingFiles && existingFiles.length > 0) {
    console.log(`Duplicate file detected: ${media.file_unique_id}, reusing existing file information`);
    
    // Verify the file actually exists in storage
    const fileExists = existingFiles[0].storage_path ? 
      await xdelo_validateStoragePath(`telegram-media/${existingFiles[0].storage_path}`) : 
      false;
      
    if (fileExists) {
      return {
        file_id: media.file_id,
        file_unique_id: media.file_unique_id,
        mime_type: existingFiles[0].mime_type,
        file_size: existingFiles[0].file_size || media.file_size,
        storage_path: existingFiles[0].storage_path,
        public_url: existingFiles[0].public_url,
        is_duplicate: true,
        storage_exists: true
      };
    } else {
      console.log(`File ${media.file_unique_id} exists in database but not in storage, will reupload`);
      // Continue with upload process since file doesn't actually exist
    }
  }

  try {
    // Get file info from Telegram with retry
    console.log(`Fetching file info for ${media.file_id}`);
    
    // Create request ID for tracing this download attempt
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`Download request ID: ${requestId} for file_id: ${media.file_id}`);
    
    const fileInfoResponse = await fetchWithRetry(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(media.file_id)}`,
      {
        headers: {
          'X-Request-ID': requestId,
          'Content-Type': 'application/json'
        }
      },
      3 // Try up to 3 times
    );
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      throw new Error(`Failed to get file info from Telegram: ${JSON.stringify(fileInfo)}`);
    }

    // Download file from Telegram with retry
    console.log(`Downloading file: ${fileInfo.result.file_path}`);
    const fileDataResponse = await fetchWithRetry(
      `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`,
      {
        headers: {
          'X-Request-ID': requestId
        }
      },
      3
    );
    
    const fileData = await fileDataResponse.blob();

    // Simplify MIME type detection
    const mimeType = photo ? 'image/jpeg' : 
                    video?.mime_type || (video ? 'video/mp4' : null) ||
                    document?.mime_type || 'application/octet-stream';
    
    // Simple storage path format - just file_unique_id.extension
    const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;

    // Upload to Supabase Storage with proper content disposition
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    console.log(`Uploading file to storage: ${fileName}`);
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(fileName, fileData, uploadOptions);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Failed to upload media to storage: ${uploadError.message}`);
    }

    // Generate public URL with correct path
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;

    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      mime_type_original: document?.mime_type || video?.mime_type,
      file_size: media.file_size || fileData.size,
      storage_path: fileName,
      public_url: publicUrl,
      is_duplicate: false,
      storage_exists: true,
      storage_path_standardized: true
    };
  } catch (error) {
    console.error('Error downloading media from Telegram:', error);
    
    // If download fails, construct a URL based on file_unique_id and mark for redownload
    const mimeType = video?.mime_type || (video ? 'video/mp4' : null) || 
                 document?.mime_type || 'application/octet-stream';
    const extension = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const fileName = `${media.file_unique_id}.${extension}`;
    const publicUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${fileName}`;
    
    // Log the error but don't throw - we'll return a placeholder and flag for redownload
    return {
      file_id: media.file_id,
      file_unique_id: media.file_unique_id,
      mime_type: mimeType,
      mime_type_original: document?.mime_type || video?.mime_type,
      file_size: media.file_size,
      storage_path: fileName,
      public_url: publicUrl,
      needs_redownload: true,
      redownload_reason: error.message,
      redownload_flagged_at: new Date().toISOString(),
      is_duplicate: false,
      storage_exists: false,
      error_code: (error as any).code || 'DOWNLOAD_FAILED',
      error_message: error.message
    };
  }
};

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

// Enhanced function to redownload missing files
export const redownloadMissingFile = async (message: MessageRecord): Promise<{success: boolean, message: string, data?: any}> => {
  try {
    console.log('Attempting to redownload file for message:', message.id);
    
    if (!message.file_id) {
      throw new Error('Missing file_id for redownload');
    }
    
    // Basic file_id format validation
    if (!FILE_ID_REGEX.test(message.file_id)) {
      console.log(`Warning: file_id format looks suspicious in redownload: ${message.file_id}`);
      // Continue anyway as Telegram sometimes changes their format
    }
    
    // Create request ID for tracing this download attempt
    const requestId = crypto.randomUUID().substring(0, 8);
    
    // Get file info from Telegram with retry
    const fileInfoResponse = await fetchWithRetry(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(message.file_id)}`,
      {
        headers: {
          'X-Request-ID': requestId,
          'Content-Type': 'application/json'
        }
      },
      3
    );
    
    const fileInfo = await fileInfoResponse.json();

    if (!fileInfo.ok) {
      // Try alternate file_id from media_group if available
      if (message.media_group_id) {
        const { data: groupData } = await supabase.rpc(
          'xdelo_find_valid_file_id',
          {
            p_media_group_id: message.media_group_id,
            p_file_unique_id: message.file_unique_id
          }
        );
        
        if (groupData) {
          console.log(`Found alternate file_id in media group: ${groupData}`);
          // Retry with new file_id
          const alternateFileInfoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(groupData)}`;
          const alternateResponse = await fetch(alternateFileInfoUrl, {
            headers: {
              'X-Request-ID': requestId,
              'Content-Type': 'application/json'
            }
          });
          
          if (!alternateResponse.ok) {
            throw new Error(`Failed to get file info with alternate file_id: ${await alternateResponse.text()}`);
          }
          
          const alternateFileInfo = await alternateResponse.json();
          
          if (!alternateFileInfo.ok) {
            throw new Error('Failed with alternate file_id as well');
          }
          
          // Use the alternate file info and update file_id
          fileInfo.result = alternateFileInfo.result;
          message.file_id = groupData;
        } else {
          throw new Error(`No valid file_id found: ${JSON.stringify(fileInfo)}`);
        }
      } else {
        throw new Error(`No valid file_id found: ${JSON.stringify(fileInfo)}`);
      }
    }
    
    // Download file from Telegram
    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.result.file_path}`;
    const fileResponse = await fetchWithRetry(
      downloadUrl,
      {
        headers: {
          'X-Request-ID': requestId
        }
      },
      3
    );
    
    const fileData = await fileResponse.blob();
    
    // Standardize storage path
    const mimeType = message.mime_type || 'application/octet-stream';
    const storagePath = xdelo_validateAndFixStoragePath(message.file_unique_id, mimeType);
    
    // Upload to storage
    const uploadOptions = xdelo_getUploadOptions(mimeType);
    const { error: uploadError } = await supabase
      .storage
      .from('telegram-media')
      .upload(storagePath, fileData, uploadOptions);
      
    if (uploadError) {
      throw new Error(`Failed to upload to storage: ${uploadError.message}`);
    }
    
    // Update the message record
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_id: message.file_id, // May have been updated with an alternate ID
        storage_path: storagePath,
        public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/telegram-media/${storagePath}`,
        error_message: null,
        error_code: null, 
        needs_redownload: false,
        redownload_completed_at: new Date().toISOString(),
        redownload_attempts: (message.redownload_attempts || 0) + 1,
        storage_exists: true,
        storage_path_standardized: true,
        file_size: fileData.size || message.file_size
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
        storagePath,
        fileSize: fileData.size
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
