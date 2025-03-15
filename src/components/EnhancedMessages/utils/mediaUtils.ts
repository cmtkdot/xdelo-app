
import { Message } from '@/types';

/**
 * Unified interface for Telegram video metadata
 */
interface TelegramVideo {
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
}

/**
 * Type-safe access to telegram_data properties
 */
export const getTelegramData = (message: Message): Record<string, any> | null => {
  if (!message.telegram_data || typeof message.telegram_data !== 'object') {
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
  // Check telegram_data first (most reliable)
  const videoMetadata = getVideoMetadata(message);
  if (videoMetadata) {
    return true;
  }
  
  // Fallback to mime type check
  if (message.mime_type?.startsWith('video/')) {
    return true;
  }
  
  // Fallback to URL file extension check
  if (message.public_url) {
    const videoExtensions = /\.(mp4|mov|webm|avi|mkv|mpg|mpeg|m4v|3gp)$/i;
    if (videoExtensions.test(message.public_url)) {
      return true;
    }
  }
  
  // Last fallback: Look for duration property which often indicates video
  if (message.duration) {
    return true;
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
  // First try to get dimensions from telegram_data
  const videoMetadata = getVideoMetadata(message);
  if (videoMetadata && videoMetadata.width && videoMetadata.height) {
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
  // First try to get duration from telegram_data
  const videoMetadata = getVideoMetadata(message);
  if (videoMetadata && videoMetadata.duration) {
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
 */
export const sortMediaGroupItems = (messages: Message[]): Message[] => {
  if (!messages || messages.length <= 1) return messages;
  
  return [...messages].sort((a, b) => {
    // Put images first
    const aIsImage = a.mime_type?.startsWith('image/') || false;
    const bIsImage = b.mime_type?.startsWith('image/') || false;
    
    if (aIsImage && !bIsImage) return -1;
    if (!aIsImage && bIsImage) return 1;
    
    // Then sort by created_at
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
};
