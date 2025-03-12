
import React from 'react';
import { MessageList } from './MessageList';
import { MessageControlPanel } from './MessageControlPanel';
import { useMediaGroups } from '@/hooks/useMediaGroups';
import { StatusSummary } from './StatusSummary';
import { Spinner } from '../ui/spinner';

export function MessageListContainer() {
  const {
    data: messages,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useMediaGroups();

  const stats = {
    state_counts: {
      pending: 0,
      processing: 0,
      completed: messages?.length || 0,
      error: 0,
      total_messages: messages?.length || 0
    },
    media_type_counts: {
      photo_count: 0,
      video_count: 0,
      document_count: 0,
      other_count: 0
    },
    processing_stats: {
      avg_processing_seconds: 0,
      max_processing_seconds: 0
    },
    timestamp: new Date().toISOString()
  };

  const onRetryProcessing = async (messageId: string) => {
    console.log("Retry processing for message:", messageId);
    // In a real implementation, this would call an API to retry processing
  };

  return (
    <div className="space-y-4">
      <StatusSummary stats={stats} />

      <MessageControlPanel
        onRefresh={refetch}
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
          messages={messages || []}
          onRefresh={() => refetch()}
          onRetryProcessing={onRetryProcessing}
          stats={stats}
        />
      )}
    </div>
  );
}
