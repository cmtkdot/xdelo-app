
import React, { useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { Card, CardContent } from '@/components/ui/card';
import { debounce } from 'lodash';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { supabase } from '@/integrations/supabase/client';
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
    processMessageQueue,
    queueUnprocessedMessages,
    processMessageById,
    isProcessing 
  } = useMessageQueue();
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleProcessQueue = async () => {
    try {
      await processMessageQueue(10);
      handleRefresh();
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };
  
  const handleQueueUnprocessed = async () => {
    try {
      await queueUnprocessedMessages(20);
      handleRefresh();
    } catch (error) {
      console.error('Failed to queue unprocessed messages:', error);
    }
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
            onQueueUnprocessed={handleQueueUnprocessed}
            onProcessQueue={handleProcessQueue}
            isProcessingAny={isProcessingAny}
            isRefreshing={isRefreshing}
          />
        </CardContent>
      </Card>
      
      <MessageList 
        messages={messages}
        isLoading={isLoading}
        onRetryProcessing={handleRetryProcessing}
        onProcessAll={handleProcessQueue}
        processAllLoading={isProcessingAny}
      />
    </div>
  );
};
