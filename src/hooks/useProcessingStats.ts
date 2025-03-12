
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingStats {
  total: number;
  initialized: number;
  pending: number;
  processing: number;
  completed: number;
  error: number;
  stalled_processing: number;
  stalled_pending: number;
  processing_times: {
    avg_minutes: number;
    max_minutes: number;
  };
}

export const useProcessingStats = (refreshInterval = 60000) => {
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const getProcessingStats = async (): Promise<ProcessingStats> => {
    try {
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (error) {
        throw new Error(`Error fetching processing stats: ${error.message}`);
      }
      
      return data as ProcessingStats;
    } catch (error) {
      console.error('Error fetching processing stats:', error);
      throw error;
    }
  };

  const { 
    data: stats, 
    isLoading, 
    error, 
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['processingStats'],
    queryFn: getProcessingStats,
    staleTime: refreshInterval,
    refetchInterval: refreshInterval,
  });

  useEffect(() => {
    if (!isRefetching && !isLoading) {
      setLastRefreshed(new Date());
    }
  }, [isRefetching, isLoading, stats]);

  return { 
    stats, 
    isLoading, 
    error, 
    refetch, 
    lastRefreshed,
    isRefetching
  };
};
