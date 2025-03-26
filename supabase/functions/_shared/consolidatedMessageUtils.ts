/**
 * Consolidated message utilities that replace multiple redundant functions
 * across the codebase. This centralized file improves maintainability
 * and ensures consistent behavior across operations.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Create Supabase client with improved configuration
export const createSupabaseClient = (
  options: { 
    timeoutSeconds?: number;
    retryAttempts?: number;
  } = {}
) => {
  const { timeoutSeconds = 15, retryAttempts = 3 } = options;
  
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          'x-statement-timeout': `${timeoutSeconds * 1000}`, // Convert to milliseconds
        },
      },
      db: {
        schema: 'public',
      },
      // Add retry configuration
      fetch: (url, init) => {
        // Custom fetch function with retry logic
        return fetchWithRetry(url, init, retryAttempts);
      }
    }
  );
};

/**
 * Custom fetch with retry logic for transient errors
 */
async function fetchWithRetry(
  url: string | URL | Request, 
  init?: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add increasing delay between retries (exponential backoff)
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
      }
      
      const response = await fetch(url, init);
      
      // Only retry on specific error status codes that might be temporary
      if (response.status !== 408 && response.status !== 429 && response.status !== 500 && response.status !== 503) {
        return response;
      }
      
      // For retryable status codes, continue to next attempt
      lastError = new Error(`Request failed with status ${response.status}`);
      
    } catch (error) {
      lastError = error as Error;
      // Continue to next retry attempt for network errors
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error('Failed after multiple retry attempts');
}

// Create a default supabase client instance for easy imports
export const supabaseClient = createSupabaseClient();

/**
 * Construct a shareable message URL for a Telegram message
 * Consolidates all telegram message URL construction logic.
 */
export function constructTelegramMessageUrl(
  chatId: number,
  messageId: number
): string | undefined {
  try {
    // Private chats don't have shareable URLs
    if (chatId > 0) {
      return undefined;
    }
    
    // Format the chat ID based on its pattern
    let formattedChatId: string;
    if (chatId.toString().startsWith('-100')) {
      // For supergroups/channels
      formattedChatId = chatId.toString().substring(4);
    } else if (chatId < 0) {
      // For regular groups
      formattedChatId = Math.abs(chatId).toString();
    } else {
      // Default case
      formattedChatId = chatId.toString();
    }
    
    return `https://t.me/c/${formattedChatId}/${messageId}`;
  } catch (error) {
    console.error('Error constructing Telegram URL:', error);
    return undefined;
  }
}

/**
 * Check if a message is forwarded from another source
 */
export function isMessageForwarded(message: any): boolean {
  if (!message) {
    return false;
  }
  
  // Check for standard forward fields
  if (message.forward_from || 
      message.forward_from_chat || 
      message.forward_date || 
      message.forward_signature || 
      message.forward_sender_name ||
      message.forward_from_message_id ||
      message.forward_origin) {
    return true;
  }
  
  return false;
}

/**
 * Extract essential metadata from a telegram_data object
 * This matches the SQL function xdelo_extract_telegram_metadata
 */
export function extractTelegramMetadata(telegramData: any): Record<string, any> {
  if (!telegramData) return {};
  
  let result: Record<string, any> = {};
  
  if (telegramData.message) {
    result = {
      message_type: 'message',
      message_id: telegramData.message.message_id,
      date: telegramData.message.date,
      chat: telegramData.message.chat,
      from: telegramData.message.from,
      media_group_id: telegramData.message.media_group_id,
      text: telegramData.message.text,
      caption: telegramData.message.caption
    };
  } else if (telegramData.channel_post) {
    result = {
      message_type: 'channel_post',
      message_id: telegramData.channel_post.message_id,
      date: telegramData.channel_post.date,
      chat: telegramData.channel_post.chat,
      media_group_id: telegramData.channel_post.media_group_id,
      text: telegramData.channel_post.text,
      caption: telegramData.channel_post.caption
    };
  } else if (telegramData.edited_message) {
    result = {
      message_type: 'edited_message',
      message_id: telegramData.edited_message.message_id,
      date: telegramData.edited_message.date,
      chat: telegramData.edited_message.chat,
      from: telegramData.edited_message.from,
      media_group_id: telegramData.edited_message.media_group_id,
      text: telegramData.edited_message.text,
      caption: telegramData.edited_message.caption,
      edit_date: telegramData.edited_message.edit_date
    };
  } else if (telegramData.edited_channel_post) {
    result = {
      message_type: 'edited_channel_post',
      message_id: telegramData.edited_channel_post.message_id,
      date: telegramData.edited_channel_post.date,
      chat: telegramData.edited_channel_post.chat,
      media_group_id: telegramData.edited_channel_post.media_group_id,
      text: telegramData.edited_channel_post.text,
      caption: telegramData.edited_channel_post.caption,
      edit_date: telegramData.edited_channel_post.edit_date
    };
  } else {
    // For unknown data, just return the original
    result = telegramData;
  }
  
  return result;
}

/**
 * Standardize file extension based on MIME type
 * Consolidates multiple MIME type handling functions
 */
export function standardizeFileExtension(mimeType: string): string {
  // Map MIME types to standard extensions
  const mimeTypeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-matroska': 'mkv',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/plain': 'txt',
    'application/zip': 'zip',
    'application/x-tgsticker': 'tgs'
  };
  
  // Return the mapped extension or extract from MIME type
  if (mimeTypeMap[mimeType]) {
    return mimeTypeMap[mimeType];
  }
  
  // Extract subtype from MIME type as fallback
  try {
    const subtype = mimeType.split('/')[1]?.split(';')[0];
    return subtype || 'bin';
  } catch {
    return 'bin';
  }
}

/**
 * Unified function to log processing events
 */
export async function logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown> = {},
  errorMessage?: string
): Promise<void> {
  try {
    // Ensure correlation ID is valid
    const validCorrelationId = 
      correlationId && 
      typeof correlationId === 'string' && 
      correlationId.length > 8 ? 
      correlationId : 
      crypto.randomUUID().toString();
    
    // Ensure metadata has a timestamp
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      correlation_id: validCorrelationId,
      logged_from: 'edge_function'
    };
    
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      metadata: enhancedMetadata,
      error_message: errorMessage,
      correlation_id: validCorrelationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error logging event: ${eventType}`, error);
  }
}

/**
 * Gets media file info from a message object
 */
export function getMediaFileInfo(message: any): { 
  fileId?: string;
  fileUniqueId?: string;
  mimeType?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number;
} {
  if (!message) return {};
  
  let fileInfo = {};
  
  // Check for photo (array of PhotoSize)
  if (message.photo && message.photo.length > 0) {
    // Get the largest photo (last in array)
    const largestPhoto = message.photo[message.photo.length - 1];
    fileInfo = {
      fileId: largestPhoto.file_id,
      fileUniqueId: largestPhoto.file_unique_id,
      mimeType: 'image/jpeg', // Default for Telegram photos
      fileSize: largestPhoto.file_size,
      width: largestPhoto.width,
      height: largestPhoto.height
    };
  } 
  // Check for video
  else if (message.video) {
    fileInfo = {
      fileId: message.video.file_id,
      fileUniqueId: message.video.file_unique_id,
      mimeType: message.video.mime_type || 'video/mp4',
      fileSize: message.video.file_size,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration
    };
  } 
  // Check for document
  else if (message.document) {
    fileInfo = {
      fileId: message.document.file_id,
      fileUniqueId: message.document.file_unique_id,
      mimeType: message.document.mime_type || 'application/octet-stream',
      fileName: message.document.file_name,
      fileSize: message.document.file_size
    };
  }
  
  return fileInfo;
}

/**
 * Check if a file already exists in the database
 */
export async function findExistingFile(fileUniqueId: string): Promise<{
  exists: boolean;
  message?: any;
}> {
  if (!fileUniqueId) {
    return { exists: false };
  }
  
  try {
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
  } catch (error) {
    console.error('Unexpected error checking for existing file:', error);
    return { exists: false };
  }
}

/**
 * Simple validation of a message ID
 */
export async function validateMessageId(messageId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .single();
      
    return !error && !!data;
  } catch {
    return false;
  }
}
