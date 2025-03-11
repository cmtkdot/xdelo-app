
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Interface matching the database response structure
interface ProcessingStatsResponse {
  state_counts: {
    pending: number;
    processing: number;
    error: number;
    completed: number;
    total_messages: number;
    initialized?: number;
  };
  media_group_stats: {
    unprocessed_with_caption?: number;
    stuck_in_processing: number;
    stalled_no_media_group?: number;
    orphaned_media_group_messages?: number;
  };
  timing_stats: {
    avg_processing_time_seconds?: number;
    oldest_unprocessed_caption_age_hours: number | null;
    oldest_stuck_processing_hours: number | null;
  };
  timestamp: string;
}

// Our flattened interface for component usage
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
      
      // Safe type guard for the response data
      const responseData = data as ProcessingStatsResponse;
      
      // Map the nested response to our flat ProcessingStats interface
      const processedStats: ProcessingStats = {
        // From state_counts
        pending_count: responseData?.state_counts?.pending || 0,
        processing_count: responseData?.state_counts?.processing || 0,
        error_count: responseData?.state_counts?.error || 0,
        completed_count: responseData?.state_counts?.completed || 0,
        total_messages: responseData?.state_counts?.total_messages || 0,
        
        // From timing_stats
        oldest_pending_age: responseData?.timing_stats?.oldest_unprocessed_caption_age_hours || null,
        oldest_processing_age: responseData?.timing_stats?.oldest_stuck_processing_hours || null,
        
        // From media_group_stats
        stalled_messages: responseData?.media_group_stats?.stuck_in_processing || 0
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
