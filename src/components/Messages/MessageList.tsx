
import React from 'react';
import { Message } from '@/types';
import { Spinner } from '@/components/ui/spinner';
import { StatusSummary } from './StatusSummary';
import { MessageCard } from './MessageCard';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onRetryProcessing: (messageId: string) => Promise<void>;
  onProcessAll: () => Promise<void>;
  processAllLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onRetryProcessing,
  onProcessAll,
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

  // Count messages by processing state
  const pendingCount = messages.filter(msg => msg.processing_state === 'pending').length;
  const processingCount = messages.filter(msg => msg.processing_state === 'processing').length;
  const errorCount = messages.filter(msg => msg.processing_state === 'error').length;
  const completedCount = messages.filter(msg => msg.processing_state === 'completed').length;

  return (
    <div className="space-y-6">
      <StatusSummary
        pendingCount={pendingCount}
        processingCount={processingCount}
        completedCount={completedCount}
        errorCount={errorCount}
        onProcessAll={onProcessAll}
        processAllLoading={processAllLoading}
      />

      <div className="space-y-4">
        {messages.map(message => (
          <MessageCard 
            key={message.id} 
            message={message} 
            onRetryProcessing={onRetryProcessing} 
          />
        ))}
      </div>
    </div>
  );
};
