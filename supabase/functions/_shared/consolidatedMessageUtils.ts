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
 * Extract the essential metadata from Telegram data
 * to prevent storing the entire large JSON object
 */
export function extractTelegramMetadata(telegramData: any): any {
  if (!telegramData) return null;
  
  // Start with the base fields we want to keep
  const metadata: any = {
    update_id: telegramData.update_id,
  };
  
  // Determine message type
  let messageObj;
  let messageType;
  
  if (telegramData.message) {
    messageObj = telegramData.message;
    messageType = 'message';
  } else if (telegramData.edited_message) {
    messageObj = telegramData.edited_message;
    messageType = 'edited_message';
  } else if (telegramData.channel_post) {
    messageObj = telegramData.channel_post;
    messageType = 'channel_post';
  } else if (telegramData.edited_channel_post) {
    messageObj = telegramData.edited_channel_post;
    messageType = 'edited_channel_post';
  } else {
    // Unknown message type, return minimal data
    return metadata;
  }
  
  metadata.message_type = messageType;
  
  // Extract essential message data
  if (messageObj) {
    metadata.message_id = messageObj.message_id;
    metadata.date = messageObj.date;
    metadata.message_thread_id = messageObj.message_thread_id;
    
    // Extract chat info
    if (messageObj.chat) {
      metadata.chat = {
        id: messageObj.chat.id,
        type: messageObj.chat.type,
        title: messageObj.chat.title,
        username: messageObj.chat.username
      };
    }
    
    // Extract sender info if available
    if (messageObj.from) {
      metadata.from = {
        id: messageObj.from.id,
        first_name: messageObj.from.first_name,
        last_name: messageObj.from.last_name,
        username: messageObj.from.username,
        is_bot: messageObj.from.is_bot
      };
    }
    
    // Extract forwarded message info
    if (isMessageForwarded(messageObj)) {
      metadata.forward_info = {
        date: messageObj.forward_date,
        from: messageObj.forward_from,
        from_chat: messageObj.forward_from_chat ? {
          id: messageObj.forward_from_chat.id,
          type: messageObj.forward_from_chat.type,
          title: messageObj.forward_from_chat.title
        } : null,
        from_message_id: messageObj.forward_from_message_id,
        signature: messageObj.forward_signature,
        sender_name: messageObj.forward_sender_name,
        origin: messageObj.forward_origin
      };
    }
    
    // Extract basic media info without large binary data
    if (messageObj.photo) {
      // For photo, just keep the largest version's metadata
      const largestPhoto = messageObj.photo[messageObj.photo.length - 1];
      metadata.media = {
        type: 'photo',
        file_id: largestPhoto.file_id,
        file_unique_id: largestPhoto.file_unique_id,
        width: largestPhoto.width,
        height: largestPhoto.height,
        file_size: largestPhoto.file_size
      };
    } else if (messageObj.video) {
      metadata.media = {
        type: 'video',
        file_id: messageObj.video.file_id,
        file_unique_id: messageObj.video.file_unique_id,
        width: messageObj.video.width,
        height: messageObj.video.height,
        duration: messageObj.video.duration,
        file_size: messageObj.video.file_size,
        mime_type: messageObj.video.mime_type
      };
    } else if (messageObj.document) {
      metadata.media = {
        type: 'document',
        file_id: messageObj.document.file_id,
        file_unique_id: messageObj.document.file_unique_id,
        file_name: messageObj.document.file_name,
        file_size: messageObj.document.file_size,
        mime_type: messageObj.document.mime_type
      };
    }
    
    // Extract text and caption
    metadata.text = messageObj.text;
    metadata.caption = messageObj.caption;
    metadata.caption_entities = messageObj.caption_entities;
    
    // Extract media group ID
    metadata.media_group_id = messageObj.media_group_id;
  }
  
  return metadata;
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
