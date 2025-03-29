
import { Message as EntityMessage } from '@/types/entities/Message';
import { Message as CoreMessage, ProcessingState } from '@/types/MessagesTypes';

/**
 * Adapts a Message from entities/Message to MessagesTypes/Message by ensuring
 * required fields are present
 */
export function adaptMessage(message: EntityMessage): CoreMessage {
  // Ensure processing_state is of correct type
  let processingState: ProcessingState = 'pending';
  
  if (message.processing_state) {
    // Type assertion for the processing state
    switch(message.processing_state) {
      case 'pending':
      case 'processing':
      case 'completed':
      case 'error':
      case 'initialized':
        processingState = message.processing_state as ProcessingState;
        break;
      default:
        processingState = 'error';
    }
  }
  
  return {
    ...message,
    file_unique_id: message.file_unique_id || '',
    public_url: message.public_url || '',
    processing_state: processingState,
  };
}

/**
 * Adapts an array of Messages from entities/Message to MessagesTypes/Message
 */
export function adaptMessages(messages: EntityMessage[]): CoreMessage[] {
  return messages.map(adaptMessage);
}
