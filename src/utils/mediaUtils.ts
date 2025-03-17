
import { Message } from "@/types/entities/Message";
import { AnalyzedContent } from "@/types/utils/AnalyzedContent";

/**
 * Unified interface for Telegram video metadata
 */
export interface TelegramVideo {
  duration?: number;
  width?: number;
  height?: number;
  file_name?: string;
  mime_type?: string;
  thumb?: {
    file_id?: string;
    width?: number;
    height?: number;
  };
  file_size?: number;
  file_id?: string;
  file_unique_id?: string;
}

/**
 * Type-safe access to telegram_data properties
 */
export const getTelegramData = (message: Message): Record<string, any> | null => {
  if (!message?.telegram_data || typeof message.telegram_data !== 'object') {
    return null;
  }
  return message.telegram_data as Record<string, any>;
};

/**
 * Get video metadata from telegram_data
 */
export const getVideoMetadata = (message: Message): TelegramVideo | null => {
  const telegramData = getTelegramData(message);
  if (!telegramData) return null;
  
  // Direct video object in telegram_data
  if (telegramData.video && typeof telegramData.video === 'object') {
    return telegramData.video as TelegramVideo;
  }
  
  // Video in document
  if (telegramData.document && 
      typeof telegramData.document === 'object' && 
      telegramData.document.mime_type && 
      typeof telegramData.document.mime_type === 'string' && 
      telegramData.document.mime_type.startsWith('video/')) {
    return telegramData.document as TelegramVideo;
  }
  
  return null;
};

/**
 * Determine if a message contains a video based on telegram_data
 * This is the primary and most reliable method for video detection
 */
export const isVideoMessage = (message: Message): boolean => {
  if (!message) return false;
  
  // Check telegram_data first (most reliable)
  const videoMetadata = getVideoMetadata(message);
  if (videoMetadata) {
    return true;
  }
  
  // Fallback to mime type check (less reliable)
  if (message.mime_type?.startsWith('video/')) {
    return true;
  }
  
  // Fallback to URL file extension check (least reliable)
  if (message.public_url) {
    const videoExtensions = /\.(mp4|mov|webm|avi|mkv|mpg|mpeg|m4v|3gp)$/i;
    if (videoExtensions.test(message.public_url)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Get the appropriate color class for a processing state
 */
export const getProcessingStateColor = (state: string): string => {
  switch (state) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    case 'error': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300';
  }
};

/**
 * Get the appropriate icon name based on media type
 */
export const getMediaIcon = (message: Message): string => {
  if (isVideoMessage(message)) {
    return 'video';
  }
  
  if (message.mime_type?.startsWith('image/')) {
    return 'image';
  }
  
  if (message.mime_type?.startsWith('audio/')) {
    return 'audio';
  }
  
  return 'file';
};

/**
 * Get video dimensions for proper aspect ratio display
 */
export const getVideoDimensions = (message: Message): { width: number; height: number } => {
  if (!message) {
    return { width: 16, height: 9 }; // Default 16:9 ratio if no message
  }
  
  // First try to get dimensions from telegram_data
  const videoMetadata = getVideoMetadata(message);
  if (videoMetadata?.width && videoMetadata?.height) {
    return {
      width: videoMetadata.width,
      height: videoMetadata.height
    };
  }
  
  // Fallback to message properties
  if (message.width && message.height) {
    return {
      width: message.width,
      height: message.height
    };
  }
  
  // Default 16:9 ratio if no dimensions available
  return {
    width: 16,
    height: 9
  };
};

/**
 * Get video duration in seconds
 */
export const getVideoDuration = (message: Message): number | null => {
  if (!message) return null;
  
  // First try to get duration from telegram_data
  const videoMetadata = getVideoMetadata(message);
  if (videoMetadata?.duration) {
    return videoMetadata.duration;
  }
  
  // Fallback to message property
  if (message.duration) {
    return message.duration;
  }
  
  return null;
};

/**
 * Sort messages within a media group with images first, then videos
 * Uses the more reliable isVideoMessage function instead of direct mime_type checks
 */
export const sortMediaGroupItems = (messages: Message[]): Message[] => {
  if (!messages || messages.length <= 1) return messages;
  
  return [...messages].sort((a, b) => {
    // Use isVideoMessage to reliably identify videos
    const aIsVideo = isVideoMessage(a);
    const bIsVideo = isVideoMessage(b);
    const aIsImage = a.mime_type?.startsWith('image/') || false;
    const bIsImage = b.mime_type?.startsWith('image/') || false;
    
    // Put images first, then videos
    if (aIsImage && !bIsImage) return -1;
    if (!aIsImage && bIsImage) return 1;
    if (!aIsVideo && bIsVideo) return -1;
    if (aIsVideo && !bIsVideo) return 1;
    
    // Then sort by created_at
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
};

/**
 * Finds the main media in a group (with caption or first item)
 */
export const getMainMediaFromGroup = (messages: Message[]): Message | null => {
  if (!messages || messages.length === 0) return null;
  
  // First, try to find message with original caption
  const originalCaption = messages.find(m => m.is_original_caption === true);
  if (originalCaption) return originalCaption;
  
  // Then, try to find any message with caption
  const withCaption = messages.find(m => !!m.caption);
  if (withCaption) return withCaption;
  
  // Finally, just return the first message as fallback
  return messages[0];
};

/**
 * Gets Telegram message URL
 */
export const getTelegramMessageUrl = (message: Message): string | null => {
  if (!message || !message.chat_id || !message.telegram_message_id) return null;
  
  return `https://t.me/c/${message.chat_id.toString().replace("-100", "")}/${message.telegram_message_id}`;
};

/**
 * Convert a Message to a MediaItem for UI components
 */
export const messageToMediaItem = (message: Message) => {
  if (!message) return null;
  
  const type = getMediaType(message.mime_type);
  
  return {
    id: message.id,
    public_url: message.public_url || '',
    type: type,
    thumbnail: type === 'image' ? message.public_url : undefined,
    width: message.width,
    height: message.height,
    title: message.analyzed_content?.product_name || message.caption,
    description: message.caption,
    mimeType: message.mime_type,
    fileSize: message.file_size,
    duration: message.duration,
    uploadedAt: message.created_at,
    // Include legacy fields for compatibility
    mime_type: message.mime_type,
    file_unique_id: message.file_unique_id,
    analyzed_content: message.analyzed_content,
    created_at: message.created_at,
    caption: message.caption,
    file_size: message.file_size,
    content_disposition: message.content_disposition,
    storage_path: message.storage_path,
    processing_state: message.processing_state
  };
};

/**
 * Determines media type from MIME type
 */
export function getMediaType(mimeType?: string): 'image' | 'video' | 'document' | 'audio' | 'unknown' {
  if (!mimeType) return 'unknown';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('application/')) return 'document';
  
  return 'unknown';
}

/**
 * Parses quantity from a caption using multiple pattern matching strategies
 * @param caption The caption text to parse
 * @returns The extracted quantity value and pattern used, or null if no quantity found
 */
export function parseQuantity(caption: string): { value: number; pattern: string } | null {
  if (!caption) return null;

  // Look for patterns like "x2", "x 2", "qty: 2", "quantity: 2"
  const patterns = [
    { regex: /qty:\s*(\d+)/i, name: 'qty-prefix' },               // qty: 2
    { regex: /quantity:\s*(\d+)/i, name: 'quantity-prefix' },     // quantity: 2
    { regex: /(\d+)\s*(?:pcs|pieces)/i, name: 'pcs-suffix' },     // 2 pcs or 2 pieces
    { regex: /(\d+)\s*(?:units?)/i, name: 'units-suffix' },       // 2 unit or 2 units
    { regex: /^.*?#.*?(?:\s+|$)(\d+)(?:\s|$)/i, name: 'after-code' }, // number after product code
    { regex: /(\d+)\s*(?=\s|$)/, name: 'standalone' },            // standalone number
    { regex: /x\s*(\d+)/i, name: 'x-prefix' },                    // x2 or x 2 (moved to end)
    { regex: /(\d+)x/i, name: 'x-suffix' }                        // 18x (new pattern)
  ];

  for (const { regex, name } of patterns) {
    const match = caption.match(regex);
    if (match && match[1]) {
      const quantity = parseInt(match[1], 10);
      if (!isNaN(quantity) && quantity > 0 && quantity < 10000) {
        return { value: quantity, pattern: name };
      }
    }
  }

  return null;
}
