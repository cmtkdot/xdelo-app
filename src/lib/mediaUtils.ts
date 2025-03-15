
import { Message } from "@/types/entities/Message";
import { MediaItem, getMediaType } from "@/types/ui/MediaItem";

/**
 * Converts a Message to a MediaItem for use in components
 */
export function messageToMediaItem(message: Message): MediaItem {
  if (!message) return null;
  
  return {
    id: message.id,
    public_url: message.public_url || '',
    mime_type: message.mime_type || '',
    file_unique_id: message.file_unique_id || '',
    created_at: message.created_at || new Date().toISOString(),
    analyzed_content: message.analyzed_content,
    caption: message.caption,
    width: message.width,
    height: message.height,
    file_size: message.file_size,
    duration: message.duration,
    content_disposition: message.content_disposition,
    storage_path: message.storage_path,
    processing_state: message.processing_state,
    type: getMediaType(message.mime_type)
  };
}

/**
 * Takes an array of Message objects and converts them to MediaItem objects
 */
export function messagesToMediaItems(messages: Message[]): MediaItem[] {
  if (!messages || !Array.isArray(messages)) return [];
  return messages.map(messageToMediaItem);
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
 * Gets Telegram message URL
 */
export function getTelegramMessageUrl(message: Message): string | null {
  if (!message || !message.chat_id || !message.telegram_message_id) return null;
  
  return `https://t.me/c/${message.chat_id.toString().replace("-100", "")}/${message.telegram_message_id}`;
}

// Re-export getMediaType for convenience
export { getMediaType };
