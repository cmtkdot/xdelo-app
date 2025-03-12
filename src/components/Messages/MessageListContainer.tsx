
import React from 'react';
import { MessageList } from './MessageList';
import { MessageControlPanel } from './MessageControlPanel';
import { useMediaGroups } from '@/hooks/useMediaGroups';
import { Spinner } from '../ui/spinner';

export function MessageListContainer() {
  const {
    data: messages,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useMediaGroups();

  const onRetryProcessing = async (messageId: string) => {
    console.log("Retry processing for message:", messageId);
    // In a real implementation, this would call an API to retry processing
  };

  return (
    <div className="space-y-4">
      <MessageControlPanel
        onRefresh={refetch}
        isRefreshing={isRefetching}
        messageCount={messages?.length || 0}
      />

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
          <p className="text-red-800 dark:text-red-200">Error loading messages: {error.message}</p>
        </div>
      ) : (
        <MessageList 
          messages={messages || []}
          onRefresh={() => refetch()}
          onRetryProcessing={onRetryProcessing}
          processAllLoading={isRefetching}
        />
      )}
    </div>
  );
}
