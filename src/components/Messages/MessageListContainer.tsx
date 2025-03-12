
import React from 'react';
import { MessageList } from './MessageList';
import { MessageControlPanel } from './MessageControlPanel';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { StatusSummary } from './StatusSummary';
import { Spinner } from '../ui/spinner';

export function MessageListContainer() {
  const {
    messages,
    isLoading,
    error,
    refetch,
    isRefetching,
    stats,
    handleRefresh
  } = useMessageQueue();

  const handleRetryProcessing = async (messageId: string) => {
    // This would need to be implemented to handle retrying a specific message
    console.log('Retrying processing for message:', messageId);
  };

  return (
    <div className="space-y-4">
      <StatusSummary stats={stats} />

      <MessageControlPanel
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        messageCount={messages?.length || 0}
        stats={stats}
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
          messages={messages} 
          onRefresh={refetch} 
          onRetryProcessing={handleRetryProcessing}
          stats={stats}
        />
      )}
    </div>
  );
}
