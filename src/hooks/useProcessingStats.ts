
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingStats {
  total_messages: number;
  by_state: {
    initialized: number;
    pending: number;
    processing: number;
    completed: number;
    error: number;
  };
  with_analyzed_content: number;
  with_caption: number;
  needs_redownload: number;
  with_media_group_id: number;
  stalled_processing: number;
}

export function useProcessingStats(refreshInterval = 0) {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Using the new xdelo_get_message_processing_stats function
      const { data, error: fetchError } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (fetchError) throw fetchError;
      
      setStats(data as ProcessingStats);
    } catch (err) {
      console.error('Error fetching processing stats:', err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Set up polling if refresh interval is provided
    let intervalId: number | undefined;
    if (refreshInterval > 0) {
      intervalId = window.setInterval(fetchStats, refreshInterval);
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
    };
  }, [refreshInterval]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats
  };
}
