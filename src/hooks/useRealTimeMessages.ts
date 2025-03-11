
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';
import { toast } from 'sonner';

interface UseRealTimeMessagesOptions {
  limit?: number;
  filter?: string;
}

export function useRealTimeMessages({ limit = 20, filter = '' }: UseRealTimeMessagesOptions = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Main query to fetch messages
  const {
    data: messages = [],
    isLoading,
    refetch,
    error
  } = useQuery({
    queryKey: ['messages', limit, filter],
    queryFn: async () => {
      try {
        let query = supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
          
        if (filter) {
          query = query.or(`caption.ilike.%${filter}%,analyzed_content->product_name.ilike.%${filter}%,analyzed_content->vendor_uid.ilike.%${filter}%,telegram_message_id.eq.${!isNaN(parseInt(filter)) ? filter : 0},chat_title.ilike.%${filter}%`);
        }
        
        const { data, error } = await query;
          
        if (error) throw error;
        return data as Message[];
      } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
      }
    },
    staleTime: 5000, // Consider data fresh for 5 seconds
  });

  // Set up real-time subscription
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

  // Manual refresh function
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
