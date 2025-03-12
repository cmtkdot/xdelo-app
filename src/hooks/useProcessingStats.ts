
import { useEffect, useState } from 'react';
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

export const useProcessingStats = () => {
  const [stats, setStats] = useState<ProcessingStats>({
    total: 0,
    initialized: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
    stalled_processing: 0,
    stalled_pending: 0,
    processing_times: {
      avg_minutes: 0,
      max_minutes: 0
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (error) throw error;
      
      setStats(data as ProcessingStats);
    } catch (err: any) {
      console.error('Error fetching processing stats:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Set up a refresh interval
    const interval = setInterval(fetchStats, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);

  const refetch = async () => {
    await fetchStats();
  };

  return { stats, isLoading, error, refetch };
};
