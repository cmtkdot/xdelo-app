
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
    total: messages?.length || 0,
    pending: 0,
    processing: 0,
    completed: messages?.length || 0,
    error: 0,
    by_processing_state: {
      pending: 0,
      processing: 0,
      completed: messages?.length || 0,
      error: 0
    },
    by_media_type: {
      photo: 0,
      video: 0,
      document: 0,
      other: 0
    },
    processing_times: {
      avg_seconds: 0,
      max_seconds: 0
    },
    latest_update: new Date().toISOString()
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
          onRefresh={refetch}
          stats={stats}
        />
      )}
    </div>
  );
}
