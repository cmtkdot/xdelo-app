
import { TelegramMessage } from '../../types';
import { ForwardInfo } from '../../types';

export function extractForwardInfo(message: TelegramMessage): ForwardInfo | undefined {
  if (!message.forward_origin && !message.forward_from_chat) {
    return undefined;
  }

  return {
    is_forwarded: true,
    forward_origin_type: message.forward_origin?.type,
    forward_from_chat_id: message.forward_from_chat?.id || message.forward_origin?.chat?.id,
    forward_from_chat_title: message.forward_from_chat?.title || message.forward_origin?.chat?.title,
    forward_from_chat_type: message.forward_from_chat?.type || message.forward_origin?.chat?.type,
    forward_from_message_id: message.forward_from_message_id,
    forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : undefined
  };
}
