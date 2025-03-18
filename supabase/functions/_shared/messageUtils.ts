
/**
 * Constructs a Telegram message URL from message data
 * 
 * @param message The Telegram message object with chat and message_id properties
 * @returns string URL or null if invalid/not shareable
 */
export function constructTelegramMessageUrl(message: any): string | null {
  if (!message || !message.chat || !message.message_id) {
    return null;
  }

  const chat_id = message.chat.id;
  const message_id = message.message_id;
  const base_url = 'https://t.me/';

  // Private chats don't have shareable URLs
  if (chat_id > 0) {
    return null;
  }

  // Handle different chat types
  if (chat_id < -100000000000) {
    // Supergroups/channels with -100 prefix
    const processed_chat_id = Math.abs(chat_id).toString().substring(3);
    return `${base_url}c/${processed_chat_id}/${message_id}`;
  } else if (chat_id < 0) {
    // Regular groups
    const processed_chat_id = Math.abs(chat_id).toString();
    return `${base_url}c/${processed_chat_id}/${message_id}`;
  }

  // Default case
  return `${base_url}c/${chat_id}/${message_id}`;
}

/**
 * Utility function to determine if a message is forwarded based on Telegram message data
 * 
 * @param message The Telegram message object
 * @returns boolean indicating if the message is forwarded
 */
export function isMessageForwarded(message: any): boolean {
  return !!(
    message &&
    (message.forward_origin || 
     message.forward_from || 
     message.forward_from_chat || 
     message.forward_sender_name || 
     message.forward_date)
  );
}

// Export existing functions
export * from './cors.ts';
export * from './mediaUtils.ts';
