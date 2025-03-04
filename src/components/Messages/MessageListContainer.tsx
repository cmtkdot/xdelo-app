
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { Spinner } from '@/components/ui/spinner';
import { useMessageProcessing } from '@/hooks/useMessageProcessing';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export const MessageListContainer: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { toast } = useToast();
  
  const { 
    handleReanalyze, 
    processMessageQueue,
    queueUnprocessedMessages,
    isProcessing: processingState
  } = useMessageProcessing();
  
  // Refactored fetch messages function with better error handling
  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      setMessages(data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error Loading Messages",
        description: error.message || "An error occurred while loading messages",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);
  
  // Refresh function for manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMessages();
  }, [fetchMessages]);
  
  const handleProcessQueue = async () => {
    try {
      await processMessageQueue(10);
      // Refresh the list after processing
      handleRefresh();
    } catch (error) {
      console.error('Failed to process queue:', error);
    }
  };
  
  const handleQueueUnprocessed = async () => {
    try {
      await queueUnprocessedMessages(20);
      // Refresh the list after queueing
      handleRefresh();
    } catch (error) {
      console.error('Failed to queue unprocessed messages:', error);
    }
  };

  const handleRetryProcessing = async (messageId) => {
    try {
      // Get the message details for reanalysis
      const { data: messageData } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (!messageData) {
        throw new Error('Message not found');
      }
      
      await handleReanalyze(messageData);
      // Refresh after processing
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
      <div className="flex flex-wrap gap-2 md:gap-4 items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-medium">Messages Queue</h2>
          {lastRefresh && (
            <p className="text-xs text-gray-500 hidden md:block">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={isProcessingAny}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="secondary" 
            onClick={handleQueueUnprocessed}
            disabled={isProcessingAny}
          >
            {isProcessingAny && <Loader2 size="sm" className="mr-2 h-4 w-4 animate-spin" />}
            Find & Queue Unprocessed
          </Button>
          <Button 
            variant="default" 
            onClick={handleProcessQueue}
            disabled={isProcessingAny}
          >
            {isProcessingAny && <Loader2 size="sm" className="mr-2 h-4 w-4 animate-spin" />}
            Process Queue
          </Button>
        </div>
      </div>
      
      {isRefreshing ? (
        <div className="flex items-center justify-center p-8">
          <Spinner size="lg" />
        </div>
      ) : (
        <MessageList 
          messages={messages}
          isLoading={isLoading}
          onRetryProcessing={handleRetryProcessing}
          onProcessAll={handleProcessQueue}
          processAllLoading={isProcessingAny}
        />
      )}
    </div>
  );
};
