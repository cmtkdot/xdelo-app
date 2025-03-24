
import { Message } from '@/types/entities/Message';

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
    const messageData = message.telegram_data as any;
    
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
    const td = message.telegram_data as any;
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
