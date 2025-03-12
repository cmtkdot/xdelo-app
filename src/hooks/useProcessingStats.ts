
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingStats {
  state_counts: {
    initialized: number;
    pending: number;
    processing: number;
    completed: number;
    error: number;
    total_messages: number;
  };
  media_group_stats: {
    unprocessed_with_caption: number;
    stuck_in_processing: number;
    stalled_no_media_group: number;
    orphaned_media_group_messages: number;
  };
  timing_stats: {
    avg_processing_time_seconds: number;
    oldest_unprocessed_caption_age_hours: number;
    oldest_stuck_processing_hours: number;
  };
  timestamp: string;
}

export function useProcessingStats(autoRefresh = false, refreshInterval = 30000) {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Call the custom Postgres function to get processing stats
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (error) throw error;
      
      setStats(data as ProcessingStats);
      return data;
    } catch (err) {
      console.error('Error fetching processing stats:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchStats();
    
    // Set up auto refresh if enabled
    let intervalId: number | undefined;
    if (autoRefresh) {
      intervalId = window.setInterval(fetchStats, refreshInterval);
    }
    
    // Clean up on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh, refreshInterval]);

  return {
    stats,
    isLoading,
    error,
    refreshStats: fetchStats
  };
}
