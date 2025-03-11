
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
      
      setStats(data);
      return data;
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
