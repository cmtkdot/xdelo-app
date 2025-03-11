
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingStats {
  // State counts
  pending_count: number;
  processing_count: number;
  error_count: number;
  completed_count: number;
  total_messages: number;
  
  // Timing metrics
  oldest_pending_age: number | null;
  oldest_processing_age: number | null;
  
  // Issue indicators
  stalled_messages: number;
}

export function useProcessingStats() {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  
  const getProcessingStats = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('xdelo_get_message_processing_stats');
      
      if (error) throw error;
      
      // The database function returns a nested structure with state_counts, media_group_stats, and timing_stats
      // We need to map this to our flat ProcessingStats interface
      const processedStats: ProcessingStats = {
        // From state_counts
        pending_count: data?.state_counts?.pending || 0,
        processing_count: data?.state_counts?.processing || 0,
        error_count: data?.state_counts?.error || 0,
        completed_count: data?.state_counts?.completed || 0,
        total_messages: data?.state_counts?.total_messages || 0,
        
        // From timing_stats
        oldest_pending_age: data?.timing_stats?.oldest_unprocessed_caption_age_hours || null,
        oldest_processing_age: data?.timing_stats?.oldest_stuck_processing_hours || null,
        
        // From media_group_stats
        stalled_messages: data?.media_group_stats?.stuck_in_processing || 0
      };
      
      setStats(processedStats);
      return processedStats;
    } catch (error: any) {
      console.error('Error fetching processing stats:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    getProcessingStats,
    stats,
    isLoading
  };
}
