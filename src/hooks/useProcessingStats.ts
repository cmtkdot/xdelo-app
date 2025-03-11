
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessingStats {
  pending_count: number;
  processing_count: number;
  error_count: number;
  completed_count: number;
  total_messages: number;
  oldest_pending_age: number | null;
  oldest_processing_age: number | null;
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
      
      // Convert the returned JSON data to the expected ProcessingStats type
      const processedStats: ProcessingStats = {
        pending_count: data.pending_count || 0,
        processing_count: data.processing_count || 0,
        error_count: data.error_count || 0,
        completed_count: data.completed_count || 0,
        total_messages: data.total_messages || 0,
        oldest_pending_age: data.oldest_pending_age,
        oldest_processing_age: data.oldest_processing_age,
        stalled_messages: data.stalled_messages || 0
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
