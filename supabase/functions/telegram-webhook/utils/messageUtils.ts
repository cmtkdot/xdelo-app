
import { TelegramMessage } from '../types.ts';

/**
 * Construct a Telegram message URL from chat ID and message ID
 */
export function constructTelegramMessageUrl(chatId: number, messageId: number): string {
  // For channel posts (chatId starts with -100)
  if (chatId.toString().startsWith('-100')) {
    const channelId = chatId.toString().substring(4);
    return `https://t.me/c/${channelId}/${messageId}`;
  }
  
  // For private chats (we can't construct a URL)
  return '';
}

/**
 * Prepare an edit history entry based on what changed in the message
 */
export function prepareEditHistoryEntry(
  existingMessage: any, 
  newMessage: TelegramMessage, 
  changeType: 'caption' | 'media' | 'text_to_media' | 'media_to_text'
): Record<string, any> {
  const timestamp = new Date().toISOString();
  const editDate = newMessage.edit_date ? 
    new Date(newMessage.edit_date * 1000).toISOString() : 
    timestamp;
  
  // Base record
  const historyEntry: Record<string, any> = {
    timestamp,
    edit_date: editDate,
    edit_source: 'telegram_edit',
    change_type: changeType
  };
  
  // Add specific fields based on change type
  switch (changeType) {
    case 'caption':
      historyEntry.previous_caption = existingMessage.caption;
      historyEntry.new_caption = newMessage.caption;
      
      // Include analyzed content if available for better tracking
      if (existingMessage.analyzed_content) {
        historyEntry.previous_analyzed_content = existingMessage.analyzed_content;
      }
      
      break;
    case 'media':
      historyEntry.previous_file_id = existingMessage.file_id;
      historyEntry.previous_file_unique_id = existingMessage.file_unique_id;
      
      // Determine new file details
      const newFile = newMessage.photo ? 
        newMessage.photo[newMessage.photo.length - 1] : 
        newMessage.video || newMessage.document;
        
      if (newFile) {
        historyEntry.new_file_id = newFile.file_id;
        historyEntry.new_file_unique_id = newFile.file_unique_id;
      }
      break;
    case 'text_to_media':
      historyEntry.previous_message_text = existingMessage.message_text;
      historyEntry.conversion_type = 'text_to_media';
      break;
    case 'media_to_text':
      historyEntry.previous_file_id = existingMessage.file_id;
      historyEntry.previous_file_unique_id = existingMessage.file_unique_id;
      historyEntry.conversion_type = 'media_to_text';
      break;
  }
  
  return historyEntry;
}

/**
 * Extracts caption from a Telegram message
 */
export function extractCaption(message: TelegramMessage): string | undefined {
  return message.caption || undefined;
}

/**
 * Determines if a message has a caption
 */
export function hasCaption(message: TelegramMessage): boolean {
  return typeof message.caption === 'string' && message.caption.trim().length > 0;
}

/**
 * Helper function to safely parse JSON
 */
export function safeJsonParse(jsonString: string, fallback: any = {}): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return fallback;
  }
}
