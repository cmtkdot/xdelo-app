
import { Message } from '@/types/entities/Message';

// Define types for Telegram data structure
interface TelegramVideo {
  duration?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

interface TelegramMessageData {
  video?: TelegramVideo;
  message?: {
    video?: TelegramVideo;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Checks if a message is a video based on its MIME type or Telegram data
 */
export function isVideoMessage(message: Message): boolean {
  // Primary check: MIME type
  if (message.mime_type?.startsWith('video/')) {
    return true;
  }
  
  // Secondary check: Telegram data
  if (message.telegram_data) {
    const messageData = message.telegram_data as TelegramMessageData;
    
    // Check for video field in message object
    if (messageData.video) {
      return true;
    }
    
    // Check for video in message.message object (common structure)
    if (messageData.message?.video) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the duration of a video in a human-readable format
 */
export function getVideoDuration(message: Message): string | null {
  let durationSecs = message.duration;
  
  // Try to get duration from telegram_data if not available directly
  if (!durationSecs && message.telegram_data) {
    const td = message.telegram_data as TelegramMessageData;
    durationSecs = td.video?.duration || td.message?.video?.duration;
  }
  
  if (!durationSecs) return null;
  
  // Format duration as MM:SS
  const minutes = Math.floor(durationSecs / 60);
  const seconds = Math.floor(durationSecs % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get the telegram message URL from a message object
 */
export function getTelegramMessageUrl(message: Message): string | null {
  if (!message.chat_id || !message.telegram_message_id) return null;
  
  // Convert private channel format (-100...) to public format
  const chatId = message.chat_id.toString().replace('-100', '');
  return `https://t.me/c/${chatId}/${message.telegram_message_id}`;
}

/**
 * Sorts media group items to show images first, then videos
 */
export function sortMediaGroupItems(items: Message[]): Message[] {
  if (!items || items.length <= 1) return items;
  
  return [...items].sort((a, b) => {
    // Show images before videos
    const aIsVideo = isVideoMessage(a);
    const bIsVideo = isVideoMessage(b);
    
    if (aIsVideo && !bIsVideo) return 1;
    if (!aIsVideo && bIsVideo) return -1;
    
    // If both are the same type, preserve order based on telegram_message_id
    if (a.telegram_message_id && b.telegram_message_id) {
      return a.telegram_message_id - b.telegram_message_id;
    }
    
    return 0;
  });
}

/**
 * Get color class for processing state
 */
export function getProcessingStateColor(state: string): string {
  switch (state) {
    case 'completed':
      return 'bg-green-500/20 text-green-700 border-green-500/50';
    case 'processing':
      return 'bg-blue-500/20 text-blue-700 border-blue-500/50';
    case 'error':
      return 'bg-red-500/20 text-red-700 border-red-500/50';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/50';
    case 'initialized':
      return 'bg-gray-500/20 text-gray-700 border-gray-500/50';
    default:
      return 'bg-gray-500/20 text-gray-700 border-gray-500/50';
  }
}

/**
 * Get video metadata from message
 */
export function getVideoMetadata(message: Message): TelegramVideo | null {
  if (!message.telegram_data) return null;
  
  const td = message.telegram_data as TelegramMessageData;
  return td.video || (td.message?.video) || null;
}

/**
 * Get video dimensions from message
 */
export function getVideoDimensions(message: Message): { width: number; height: number } {
  const metadata = getVideoMetadata(message);
  
  if (metadata && metadata.width && metadata.height) {
    return {
      width: metadata.width,
      height: metadata.height
    };
  }
  
  // Default 16:9 aspect ratio if dimensions not available
  return { width: 16, height: 9 };
}

/**
 * Find the main media file in a group of messages (typically the first image or video)
 */
export function getMainMediaFromGroup(group: Message[]): Message | null {
  if (!group || group.length === 0) return null;
  
  // Sort to prioritize images first, then videos
  const sorted = sortMediaGroupItems(group);
  return sorted[0];
}
