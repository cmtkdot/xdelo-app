
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { Spinner } from '@/components/ui/spinner';
import { useMessageProcessing } from '@/hooks/useMessageProcessing';

export const MessageListContainer: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { 
    processMessageQueue, 
    queueUnprocessedMessages,
    isProcessing: processingState
  } = useMessageProcessing();
  
  const handleProcessQueue = async () => {
    try {
      await processMessageQueue(10);
      // Refresh the list after processing
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 1000);
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };
  
  const handleQueueUnprocessed = async () => {
    try {
      await queueUnprocessedMessages(20);
      // Refresh the list after queueing
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 1000);
    } catch (error) {
      console.error('Failed to queue unprocessed messages:', error);
    }
  };
  
  const isProcessingAny = Object.values(processingState).some(state => state) || isRefreshing;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 md:gap-4 items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-medium">Messages Queue</h2>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="secondary" 
            onClick={handleQueueUnprocessed}
            disabled={isProcessingAny}
          >
            {isProcessingAny && <Spinner size="sm" className="mr-2" />}
            Find & Queue Unprocessed
          </Button>
          <Button 
            variant="default" 
            onClick={handleProcessQueue}
            disabled={isProcessingAny}
          >
            {isProcessingAny && <Spinner size="sm" className="mr-2" />}
            Process Queue
          </Button>
        </div>
      </div>
      
      {isRefreshing ? (
        <div className="flex items-center justify-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <MessageList />
      )}
    </div>
  );
}
