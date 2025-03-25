
/**
 * Utility functions for working with Telegram messages
 */

import { TelegramMessage } from '../types.ts';

/**
 * Construct a URL to the message in Telegram
 * Function overloading to accept either message object or chat ID and message ID
 */
export function constructTelegramMessageUrl(message: TelegramMessage): string;
export function constructTelegramMessageUrl(chatId: number, messageId: number): string;
export function constructTelegramMessageUrl(chatIdOrMessage: number | TelegramMessage, messageId?: number): string {
  if (typeof chatIdOrMessage === 'object') {
    // First argument is a message object
    return constructTelegramMessageUrl(
      chatIdOrMessage.chat.id,
      chatIdOrMessage.message_id
    );
  } else {
    // First argument is chatId, second is messageId
    const chatId = chatIdOrMessage;
    // Convert private channel format (-100...) to public format
    const chatIdStr = chatId.toString();
    const formattedChatId = chatIdStr.startsWith('-100') ? chatIdStr.substring(4) : chatIdStr;
    
    return `https://t.me/c/${formattedChatId}/${messageId}`;
  }
}

/**
 * Check if a message is a forwarded message
 */
export function isMessageForwarded(message: TelegramMessage): boolean {
  return !!(
    message.forward_date || 
    message.forward_from || 
    message.forward_from_chat || 
    message.forward_origin
  );
}

/**
 * Check if a message contains media
 */
export function hasMedia(message: TelegramMessage): boolean {
  return !!(message.photo || message.video || message.document);
}

/**
 * Get the largest photo from a message
 */
export function getLargestPhoto(message: TelegramMessage): any {
  if (!message.photo || !message.photo.length) {
    return null;
  }
  
  // Photos are ordered by size, with the largest last
  return message.photo[message.photo.length - 1];
}

/**
 * Prepare edit history entry for media or text messages
 */
export function prepareEditHistoryEntry(
  existingMessage: any, 
  message: TelegramMessage, 
  changeType: 'caption' | 'media' | 'text' | 'media_to_text' | 'text_to_media'
): any {
  const base = {
    timestamp: new Date().toISOString(),
    edit_source: 'telegram_edit',
    edit_date: message.edit_date 
      ? new Date(message.edit_date * 1000).toISOString() 
      : new Date().toISOString()
  };
  
  switch (changeType) {
    case 'caption':
      return {
        ...base,
        change_type: 'caption_changed',
        previous_caption: existingMessage.caption,
        new_caption: message.caption
      };
    case 'media':
      return {
        ...base,
        change_type: 'media_changed',
        previous_file_id: existingMessage.file_id,
        previous_file_unique_id: existingMessage.file_unique_id
      };
    case 'text':
      return {
        ...base,
        change_type: 'text_changed',
        previous_text: existingMessage.message_text
      };
    case 'media_to_text':
      return {
        ...base,
        change_type: 'media_removed',
        previous_file_id: existingMessage.file_id,
        previous_file_unique_id: existingMessage.file_unique_id
      };
    case 'text_to_media':
      return {
        ...base,
        change_type: 'media_added',
        previous_text: existingMessage.message_text
      };
    default:
      return base;
  }
}
