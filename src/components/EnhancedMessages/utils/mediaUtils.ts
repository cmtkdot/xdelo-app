
import { Message } from '@/types';

/**
 * Determine if a message contains a video based on mime type or URL pattern
 */
export const isVideoMessage = (message: Message): boolean => {
  return message.mime_type?.startsWith('video/') || 
         (message.public_url && /\.(mp4|mov|webm|avi)$/i.test(message.public_url));
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
