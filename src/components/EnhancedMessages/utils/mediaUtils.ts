
import { Message } from '@/types';

/**
 * Determine if a message contains a video based on mime type or URL pattern
 */
export const isVideoMessage = (message: Message): boolean => {
  // Check mime type first
  if (message.mime_type?.startsWith('video/')) {
    return true;
  }
  
  // Check URL file extension if mime type doesn't indicate video
  if (message.public_url) {
    const videoExtensions = /\.(mp4|mov|webm|avi|mkv|mpg|mpeg|m4v|3gp)$/i;
    if (videoExtensions.test(message.public_url)) {
      return true;
    }
  }
  
  // Check if it's marked as video in telegram_data (for application/octet-stream)
  if (message.telegram_data && typeof message.telegram_data === 'object') {
    // Type guard to check if telegram_data is an object before accessing properties
    const telegramData = message.telegram_data as Record<string, any>;
    
    if (telegramData.video || 
       (telegramData.document?.mime_type && 
        typeof telegramData.document.mime_type === 'string' &&
        telegramData.document.mime_type.startsWith('video/'))) {
      return true;
    }
  }

  // Handle specific octet-stream cases that we know are videos
  if (message.mime_type === 'application/octet-stream' && 
      (message.duration || 
      (message.telegram_data && 
       typeof message.telegram_data === 'object' && 
       (message.telegram_data as any).document?.mime_type?.startsWith('video/')))) {
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
