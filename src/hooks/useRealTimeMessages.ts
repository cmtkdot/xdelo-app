
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { Message, ProcessingState } from '@/types';

// Export for other components to use
export type ProcessingStateType = ProcessingState;

interface UseRealTimeMessagesParams {
  filter?: string;
  processingState?: ProcessingStateType[] | undefined;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showForwarded?: boolean;
  showEdited?: boolean;
  limit?: number;
}

export function useRealTimeMessages({
  filter = '',
  processingState,
  sortBy = 'updated_at',
  sortOrder = 'desc',
  showForwarded = false,
  showEdited = false,
  limit = 100
}: UseRealTimeMessagesParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { toast } = useToast();

  // Function to fetch messages with filters
  const fetchMessages = useCallback(async () => {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .limit(limit);
      
      // Apply search filter if provided
      if (filter) {
        query = query.or(`caption.ilike.%${filter}%,analyzed_content->product_name.ilike.%${filter}%,analyzed_content->product_code.ilike.%${filter}%`);
      }
      
      // Apply processing state filter if provided
      if (processingState && processingState.length > 0) {
        query = query.in('processing_state', processingState as ProcessingState[]);
      }
      
      // Only show forwarded messages if requested
      if (!showForwarded) {
        query = query.is('is_forward', false);
      }
      
      // Only show edited messages if requested
      if (showEdited) {
        query = query.gt('edit_count', 0);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setMessages(data as Message[]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Failed to load messages",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter, processingState, sortBy, sortOrder, showForwarded, showEdited, limit, toast]);
  
  // Function to manually refresh messages
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMessages();
  }, [fetchMessages]);
  
  // Initial fetch and setup realtime subscription
  useEffect(() => {
    setIsLoading(true);
    fetchMessages();
    
    // Set up realtime subscription
    const subscription = supabase
      .channel('message-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages' 
      }, () => {
        fetchMessages();
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    isRefreshing,
    lastRefresh,
    handleRefresh
  };
}
