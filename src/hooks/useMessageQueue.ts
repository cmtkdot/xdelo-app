import { useState, useEffect } from 'react';
import { useSupabase } from '@/integrations/supabase/SupabaseProvider';
import { Message, MessageProcessingStats, ProcessingState } from '@/types/MessagesTypes';
import { useToast } from './useToast';

export function useMessageQueue() {
  const { supabase: supabaseClient } = useSupabase();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isRefetching, setIsRefetching] = useState(false);
  const [stats, setStats] = useState<MessageProcessingStats>({
    state_counts: {
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0,
      total_messages: 0
    }
  });

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setMessages(data as Message[]);
      
      const stateCounts = {
        pending: 0,
        processing: 0,
        completed: 0,
        error: 0,
        total_messages: data.length
      };
      
      data.forEach((message: Message) => {
        const state = message.processing_state as ProcessingState;
        if (state in stateCounts) {
          stateCounts[state]++;
        }
      });
      
      setStats({ state_counts: stateCounts });
      
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching messages'));
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const refetch = async () => {
    setIsRefetching(true);
    await fetchMessages();
  };

  const handleRefresh = () => {
    refetch();
  };

  const retryMessage = async (messageId: string) => {
    try {
      const { data, error } = await supabaseClient.functions.invoke('xdelo_reprocess_message', {
        body: { messageId }
      });

      if (error) throw error;

      toast({
        title: 'Processing started',
        description: 'Message is being reprocessed',
      });

      await refetch();
      return data;
    } catch (err) {
      console.error('Error retrying message:', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to retry message processing',
        variant: 'destructive',
      });
    }
  };

  return {
    messages,
    isLoading,
    error,
    refetch,
    isRefetching,
    stats,
    handleRefresh,
    retryMessage
  };
}
