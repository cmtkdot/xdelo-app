
import { useEffect, useState } from 'react';
import { Message as EntityMessage } from '@/types/entities/Message';
import { Message as CoreMessage } from '@/types/MessagesTypes';
import { adaptMessage } from '@/lib/messageAdapter';

interface MessageAdapterProps<T> {
  message: EntityMessage;
  render: (message: CoreMessage) => T;
}

/**
 * Component that adapts an EntityMessage to a CoreMessage to ensure
 * type compatibility with components that expect CoreMessage
 */
export function MessageAdapter<T>({ message, render }: MessageAdapterProps<T>): T {
  const [adaptedMessage, setAdaptedMessage] = useState<CoreMessage>(() => 
    adaptMessage(message)
  );
  
  // Re-adapt message when it changes
  useEffect(() => {
    setAdaptedMessage(adaptMessage(message));
  }, [message]);
  
  return render(adaptedMessage);
}
