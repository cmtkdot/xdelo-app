
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface MessageProcessingStats {
  total_messages: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
  partial_success: number;
  need_attention: number;
  recently_processed: number;
}

export function useProcessingStats(refreshIntervalMs = 10000) {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProcessingStats = async (): Promise<MessageProcessingStats> => {
    try {
      // Call the RPC function to get processing stats - fixed type issue
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats' as any);
      
      if (error) {
        console.error('Error fetching processing stats:', error);
        throw error;
      }
      
      // Ensure we have valid data
      if (!data) {
        return {
          total_messages: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          error: 0,
          partial_success: 0,
          need_attention: 0,
          recently_processed: 0
        };
      }
      
      setLastRefresh(new Date());
      return data;
    } catch (error) {
      console.error('Error in fetchProcessingStats:', error);
      throw error;
    }
  };

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['processingStats'],
    queryFn: fetchProcessingStats,
    refetchInterval: refreshIntervalMs,
    refetchIntervalInBackground: false
  });

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    stats: stats || {
      total_messages: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      error: 0,
      partial_success: 0,
      need_attention: 0,
      recently_processed: 0
    },
    isLoading,
    error,
    lastRefresh,
    isRefreshing,
    handleRefresh
  };
}
