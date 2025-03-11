
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for fetching processing statistics for messages
 */
export function useMessageProcessingStats() {
  const [isLoading, setIsLoading] = useState(false);
  const [processingStats, setProcessingStats] = useState<any>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetches processing statistics for messages
   */
  const fetchProcessingStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          operation: 'get_stats',
          trigger_source: 'manual_ui'
        }
      });
      
      if (error) throw error;
      
      setProcessingStats(data);
      return data;
    } catch (error: any) {
      console.error('Error fetching processing stats:', error);
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fetchProcessingStats,
    processingStats,
    isLoading,
    error
  };
}
