
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/MessagesTypes';
import { useToast } from './useToast';

// Export enum for ProcessingState to match database values
export enum ProcessingState {
  Initialized = 'initialized',
  Pending = 'pending',
  Processing = 'processing',
  Completed = 'completed',
  Error = 'error',
  PartialSuccess = 'partial_success'
}

// Export type for other components to use
export type ProcessingStateType = keyof typeof ProcessingState;

interface UseRealTimeMessagesProps {
  limit?: number;
  processingStates?: ProcessingState[];
  mediaGroupId?: string | null;
  chatId?: number | null;
  orderBy?: 'created_at' | 'updated_at';
  orderDirection?: 'asc' | 'desc';
}

export const useRealTimeMessages = ({
  limit = 20,
  processingStates = [
    ProcessingState.Initialized, 
    ProcessingState.Pending, 
    ProcessingState.Processing, 
    ProcessingState.Completed, 
    ProcessingState.Error
  ],
  mediaGroupId = null,
  chatId = null,
  orderBy = 'created_at',
  orderDirection = 'desc'
}: UseRealTimeMessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processAllLoading, setProcessAllLoading] = useState(false);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .in('processing_state', processingStates as any[])
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .limit(limit);

      if (mediaGroupId) {
        query = query.eq('media_group_id', mediaGroupId);
      }

      if (chatId) {
        query = query.eq('chat_id', chatId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Cast data to Message[] to fix TypeScript error
      setMessages(data as unknown as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch messages',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [limit, processingStates, mediaGroupId, chatId, orderBy, orderDirection, toast]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel('messages-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchMessages]);

  // Retry processing function
  const retryProcessing = async (messageId: string) => {
    try {
      const { error } = await supabase.functions.invoke('manual-caption-parser', {
        body: { messageId, force_reprocess: true }
      });

      if (error) throw error;

      toast({
        title: 'Processing started',
        description: 'Message processing has been triggered'
      });

      // Refresh messages
      await fetchMessages();
    } catch (error) {
      console.error('Error retrying processing:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger message processing',
        variant: 'destructive'
      });
    }
  };

  // Process all pending messages
  const processAllPending = async () => {
    setProcessAllLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_direct_process_message', {
        body: { action: 'process_pending', limit: 20 }
      });

      if (error) throw error;

      toast({
        title: 'Processing started',
        description: `Processing ${data?.processed_count || 0} messages`
      });

      // Refresh messages
      await fetchMessages();
    } catch (error) {
      console.error('Error processing all pending messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to process pending messages',
        variant: 'destructive'
      });
    } finally {
      setProcessAllLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    processAllLoading,
    retryProcessing,
    processAllPending,
    refreshMessages: fetchMessages
  };
};

export default useRealTimeMessages;
