
import { Message } from "@/types/entities/Message";

/**
 * Gets Telegram message URL
 */
export function getTelegramMessageUrl(message: Message): string | null {
  if (!message || !message.chat_id || !message.telegram_message_id) return null;
  
  return `https://t.me/c/${message.chat_id.toString().replace("-100", "")}/${message.telegram_message_id}`;
}

/**
 * Finds the main media in a group (with caption or first item)
 */
export function getMainMediaFromGroup(messages: Message[]): Message | null {
  if (!messages || messages.length === 0) return null;
  
  // First, try to find message with original caption
  const originalCaption = messages.find(m => m.is_original_caption === true);
  if (originalCaption) return originalCaption;
  
  // Then, try to find any message with caption
  const withCaption = messages.find(m => !!m.caption);
  if (withCaption) return withCaption;
  
  // Finally, just return the first message as fallback
  return messages[0];
}

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
