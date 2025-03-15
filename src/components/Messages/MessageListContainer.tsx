
import React from 'react';
import { MessageList } from './MessageList';
import { MessageControlPanel } from './MessageControlPanel';
import { Spinner } from '../ui/spinner';
import { useCaptionSync } from '@/hooks/useCaptionSync';
import { useToast } from '@/hooks/useToast';
import { useEnhancedMessages } from '@/hooks/useEnhancedMessages';
import { useMediaUtils } from '@/hooks/useMediaUtils';

export function MessageListContainer() {
  const {
    messages,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useEnhancedMessages({
    grouped: true,
    limit: 500
  });

  const { syncMessageCaption } = useCaptionSync();
  const { processMessage } = useMediaUtils();
  const { toast } = useToast();

  // Simply flatten the grouped messages
  const flatMessages = Array.isArray(messages) 
    ? messages.flatMap(group => Array.isArray(group) ? group : [])
    : [];

  const onRetryProcessing = async (messageId: string): Promise<void> => {
    try {
      toast({
        title: "Processing Message",
        description: "Analyzing caption and syncing with media group..."
      });
      
      const result = await processMessage(messageId);
      
      if (result.success) {
        await syncMessageCaption({ messageId });
        void refetch();
        
        toast({
          title: "Processing Complete",
          description: "Message has been processed and synchronized."
        });
      } else {
        throw new Error(result.message || "Processing failed");
      }
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
        messageCount={flatMessages.length}
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
          messages={flatMessages}
          onRefresh={() => { void refetch(); }}
          onRetryProcessing={onRetryProcessing}
          processAllLoading={isRefetching}
        />
      )}
    </div>
  );
}
