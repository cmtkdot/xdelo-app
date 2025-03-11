
import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { Card, CardContent } from '@/components/ui/card';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { useToast } from '@/hooks/useToast';

export const MessageListContainer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  
  const { 
    messages,
    isLoading,
    isRefreshing,
    lastRefresh,
    handleRefresh
  } = useRealTimeMessages({ filter: searchTerm });
  
  const { 
    processMessageById,
    isProcessing 
  } = useMessageQueue();
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleRetryProcessing = async (messageId) => {
    try {
      await processMessageById(messageId);
      handleRefresh();
    } catch (error) {
      console.error('Error retrying message processing:', error);
    }
  };
  
  const isProcessingAny = isProcessing || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <MessageHeader lastRefresh={lastRefresh} />
        <CardContent>
          <MessageControlPanel 
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        </CardContent>
      </Card>
      
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        onRetryProcessing={handleRetryProcessing}
        processAllLoading={isProcessingAny}
      />
    </div>
  );
};
