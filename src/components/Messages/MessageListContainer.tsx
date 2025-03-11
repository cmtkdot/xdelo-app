
import React, { useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { Card, CardContent } from '@/components/ui/card';
import { debounce } from 'lodash';
import { MessageHeader } from './MessageHeader';
import { MessageControlPanel } from './MessageControlPanel';
import { useRealTimeMessages } from '@/hooks/useRealTimeMessages';
import { useMessageProcessing } from '@/hooks/useMessageProcessing';
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
    handleReanalyze, 
    processMessageQueue,
    queueUnprocessedMessages,
    isProcessing: processingState
  } = useMessageProcessing();
  
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
      const { data: messageData } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (!messageData) {
        throw new Error('Message not found');
      }
      
      await handleReanalyze(messageData);
      handleRefresh();
    } catch (error) {
      console.error('Error retrying message processing:', error);
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to retry processing",
        variant: "destructive"
      });
    }
  };
  
  const isProcessingAny = Object.values(processingState).some(state => state) || isRefreshing;

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
