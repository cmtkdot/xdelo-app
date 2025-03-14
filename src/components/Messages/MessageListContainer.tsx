
import React from 'react';
import { MessageList } from './MessageList';
import { MessageControlPanel } from './MessageControlPanel';
import { useMediaGroups } from '@/hooks/useMediaGroups';
import { Spinner } from '../ui/spinner';
import { useCaptionSync } from '@/hooks/useCaptionSync';
import { useToast } from '@/hooks/useToast';

export function MessageListContainer() {
  const {
    data: mediaGroups,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useMediaGroups();

  const { forceSyncMessageGroup } = useCaptionSync();
  const { toast } = useToast();

  // Convert the grouped messages object to an array for rendering
  // Ensure we handle invalid data safely
  const messages = Array.isArray(mediaGroups) 
    ? mediaGroups.flatMap(group => Array.isArray(group) ? group : [])
    : [];

  const onRetryProcessing = async (messageId: string): Promise<void> => {
    try {
      toast({
        title: "Processing Message",
        description: "Analyzing caption and syncing with media group..."
      });
      
      await forceSyncMessageGroup({ messageId });
      void refetch();
      
      toast({
        title: "Processing Complete",
        description: "Message has been processed and synchronized."
      });
    } catch (error: any) {
      console.error("Error retrying processing:", error);
      toast({
        title: "Processing Failed",
        description: error.message || "An error occurred during processing",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <MessageControlPanel
        onRefresh={() => { void refetch(); }}
        isRefreshing={isRefetching}
        messageCount={messages.length}
      />

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-md">
          <p className="text-red-800 dark:text-red-200">Error loading messages: {(error as Error).message}</p>
        </div>
      ) : (
        <MessageList 
          messages={messages}
          onRefresh={() => { void refetch(); }}
          onRetryProcessing={onRetryProcessing}
          processAllLoading={isRefetching}
        />
      )}
    </div>
  );
}
