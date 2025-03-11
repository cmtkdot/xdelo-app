
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
      
      // Handle the response data safely by ensuring proper types
      const processedStats: ProcessingStats = {
        pending_count: typeof data.pending_count === 'number' ? data.pending_count : 0,
        processing_count: typeof data.processing_count === 'number' ? data.processing_count : 0,
        error_count: typeof data.error_count === 'number' ? data.error_count : 0,
        completed_count: typeof data.completed_count === 'number' ? data.completed_count : 0,
        total_messages: typeof data.total_messages === 'number' ? data.total_messages : 0,
        oldest_pending_age: typeof data.oldest_pending_age === 'number' ? data.oldest_pending_age : null,
        oldest_processing_age: typeof data.oldest_processing_age === 'number' ? data.oldest_processing_age : null,
        stalled_messages: typeof data.stalled_messages === 'number' ? data.stalled_messages : 0
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
