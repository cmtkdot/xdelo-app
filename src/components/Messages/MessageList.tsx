
import React from 'react';
import type { Message } from '@/types/MessagesTypes';
import { Spinner } from '@/components/ui/spinner';
import { MessageCard } from './MessageCard';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onRetryProcessing?: (messageId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  processAllLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onRetryProcessing = async () => {},
  onRefresh,
  processAllLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center p-8">
        <h3 className="text-xl font-semibold mb-2">No messages found</h3>
        <p className="text-gray-500">There are no messages to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {messages.map(message => (
          <MessageCard 
            key={message.id} 
            message={message} 
            onRetryProcessing={onRetryProcessing} 
            processAllLoading={processAllLoading}
          />
        ))}
      </div>
    </div>
  );
};
