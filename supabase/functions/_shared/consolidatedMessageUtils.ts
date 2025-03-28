// Removed supabaseClient import

export function constructTelegramMessageUrl(
  chatId: number,
  messageId: number
): string | undefined {
  try {
    // Private chats don't have shareable URLs
    if (chatId > 0) {
      return undefined;
    }

    // Format the chat ID based on its pattern
    let formattedChatId: string;
    if (chatId.toString().startsWith('-100')) {
      // For supergroups/channels
      formattedChatId = chatId.toString().substring(4);
    } else if (chatId < 0) {
      // For regular groups
      formattedChatId = Math.abs(chatId).toString();
    } else {
      // Default case
      formattedChatId = chatId.toString();
    }

    return `https://t.me/c/${formattedChatId}/${messageId}`;
  } catch (error) {
    console.error('Error constructing Telegram URL:', error);
    return undefined;
  }
}

/**
 * Check if a message was forwarded from another chat
 */
export function isMessageForwarded(message: any): boolean {
  return !!(
    message.forward_from ||
    message.forward_from_chat ||
    message.forward_from_message_id ||
    message.forward_signature ||
    message.forward_sender_name ||
    message.forward_date
  );
}

// Removed logProcessingEvent function definition. Import from auditLogger.ts instead.
