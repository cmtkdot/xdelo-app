
import { Message as EntityMessage } from '@/types/entities/Message';
import { Message as CoreMessage } from '@/types/MessagesTypes';

/**
 * Adapts a Message from entities/Message to MessagesTypes/Message by ensuring
 * required fields are present
 */
export function adaptMessage(message: EntityMessage): CoreMessage {
  return {
    ...message,
    file_unique_id: message.file_unique_id || '',
    public_url: message.public_url || '',
    // Add any other required fields from MessagesTypes/Message that might be missing
  };
}

/**
 * Adapts an array of Messages from entities/Message to MessagesTypes/Message
 */
export function adaptMessages(messages: EntityMessage[]): CoreMessage[] {
  return messages.map(adaptMessage);
}
