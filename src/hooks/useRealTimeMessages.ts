
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message, ProcessingState } from '@/types';
import { toast } from 'sonner';

interface UseRealTimeMessagesOptions {
  limit?: number;
  filter?: string;
  processingState?: ProcessingState[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showForwarded?: boolean;
  showEdited?: boolean;
}

export function useRealTimeMessages({ 
  limit = 20, 
  filter = '',
  processingState,
  sortBy = 'updated_at',
  sortOrder = 'desc',
  showForwarded = false,
  showEdited = false
}: UseRealTimeMessagesOptions = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const {
    data: messages = [],
    isLoading,
    refetch,
    error
  } = useQuery({
    queryKey: ['messages', limit, filter, processingState, sortBy, sortOrder, showForwarded, showEdited],
    queryFn: async () => {
      try {
        let query = supabase
          .from('messages')
          .select('*')
          .order(sortBy || 'updated_at', { ascending: sortOrder === 'asc' })
          .limit(limit);
          
        if (filter) {
          query = query.or(`caption.ilike.%${filter}%,analyzed_content->product_name.ilike.%${filter}%,analyzed_content->vendor_uid.ilike.%${filter}%,telegram_message_id.eq.${!isNaN(parseInt(filter)) ? filter : 0},chat_title.ilike.%${filter}%`);
        }
        
        if (processingState && processingState.length > 0) {
          // Explicitly cast the array to avoid TypeScript errors
          query = query.in('processing_state', processingState as unknown as readonly ProcessingState[]);
        }
        
        if (showForwarded) {
          query = query.eq('is_forward', true);
        }
        
        if (showEdited) {
          query = query.not('old_analyzed_content', 'is', null);
        }
        
        const { data, error } = await query;
          
        if (error) throw error;
        return data as Message[];
      } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
    },
    staleTime: 5000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing messages:', error);
      toast.error("Failed to refresh messages");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return {
    messages,
    isLoading,
    isRefreshing,
    lastRefresh,
    handleRefresh,
    error
  };
}
