
/**
 * Utility functions for working with Telegram messages
 */
import { TelegramMessage } from "../types.ts";

/**
 * Checks if a message is forwarded
 */
export function isMessageForwarded(message: TelegramMessage): boolean {
  return message.forward_origin !== undefined;
}

/**
 * Extracts forward information from a message
 */
export function extractForwardInfo(message: TelegramMessage) {
  if (!isMessageForwarded(message)) {
    return undefined;
  }

  return {
    is_forwarded: true,
    forward_origin_type: message.forward_origin.type,
    forward_from_chat_id: message.forward_origin.chat?.id,
    forward_from_chat_title: message.forward_origin.chat?.title,
    forward_from_chat_type: message.forward_origin.chat?.type,
    forward_from_message_id: message.forward_origin.message_id,
    forward_date: new Date(message.forward_origin.date * 1000).toISOString(),
    original_chat_id: message.forward_origin.chat?.id,
    original_chat_title: message.forward_origin.chat?.title,
    original_message_id: message.forward_origin.message_id,
  };
}
